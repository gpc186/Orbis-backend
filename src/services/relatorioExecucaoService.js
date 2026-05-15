const AppError = require("../utils/appErrorUtils");
const RelatorioAgendamentoModel = require("../models/relatorioAgendamentoModel");
const RelatorioExecucaoModel = require("../models/relatorioExecucaoModel");
const RelatorioRendererService = require("./relatorioRendererService");
const RelatorioDispatchService = require("./relatorioDispatchService");
const { computeNextRun } = require("../utils/reportScheduleUtils");
const { validatePreviewPayload } = require("../utils/reportValidation");

class RelatorioExecucaoService {
  static async executarManual({ usuario, payload }) {
    if (!usuario || usuario.role !== "ADMIN") {
      throw new AppError("Apenas ADMIN pode executar relatorios.", 403);
    }

    const normalized = validatePreviewPayload(payload);
    const emailsDestino = Array.isArray(payload.emailsDestino) ? payload.emailsDestino : [];

    if (!emailsDestino.length) {
      throw new AppError("Informe os emails de destino para envio manual.", 400);
    }

    const rendered = await RelatorioRendererService.render(normalized);

    const execution = await RelatorioExecucaoModel.create({
      agendamentoId: null,
      tipoExecucao: "MANUAL",
      status: "PROCESSANDO",
      assunto: rendered.subject,
      emailsDestino,
      periodoSnapshot: normalized.periodo,
      filtrosSnapshot: normalized.filtros,
      entidades: normalized.filtros.entidades
    });

    try {
      const dispatch = await RelatorioDispatchService.send({
        emailsDestino,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text
      });

      await RelatorioExecucaoModel.markSuccess(execution.id, {
        provider: dispatch.provider,
        messageId: dispatch.messageId,
        finalizadoEm: new Date()
      });

      return {
        execucaoId: execution.id,
        provider: dispatch.provider,
        messageId: dispatch.messageId,
        subject: rendered.subject,
        enviadoPara: emailsDestino
      };
    } catch (error) {
      await RelatorioExecucaoModel.markFailure(execution.id, {
        errorMessage: error.message,
        finalizadoEm: new Date()
      });

      throw error;
    }
  }

  static async executarAgendamento(agendamentoId) {
    const agendamento = await RelatorioAgendamentoModel.findById(agendamentoId);

    if (!agendamento) {
      throw new AppError("Agendamento de relatorio nao encontrado.", 404);
    }

    const emailsDestino = agendamento.destinatarios.map((item) => item.email);

    const execution = await RelatorioExecucaoModel.create({
      agendamentoId: agendamento.id,
      tipoExecucao: "AGENDADO",
      status: "PROCESSANDO",
      assunto: agendamento.assunto || agendamento.nome,
      emailsDestino,
      periodoSnapshot: agendamento.periodo,
      filtrosSnapshot: agendamento.filtros,
      entidades: agendamento.entidades || null
    });

    try {
      const rendered = await RelatorioRendererService.render({
        nome: agendamento.nome,
        assunto: agendamento.assunto,
        periodo: agendamento.periodo,
        filtros: {
          ...agendamento.filtros,
          entidades: Array.isArray(agendamento.entidades)
            ? agendamento.entidades
            : agendamento.filtros?.entidades
        }
      });

      const dispatch = await RelatorioDispatchService.send({
        emailsDestino,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text
      });

      const sentAt = new Date();
      const nextRunAt = computeNextRun(
        {
          frequencia: agendamento.frequencia,
          timezone: agendamento.timezone,
          hora: agendamento.hora,
          minuto: agendamento.minuto,
          diaSemana: agendamento.diaSemana,
          diaMes: agendamento.diaMes
        },
        sentAt
      );

      await Promise.all([
        RelatorioExecucaoModel.markSuccess(execution.id, {
          provider: dispatch.provider,
          messageId: dispatch.messageId,
          finalizadoEm: sentAt
        }),
        RelatorioAgendamentoModel.markSuccess({
          id: agendamento.id,
          sentAt,
          nextRunAt
        })
      ]);

      return {
        execucaoId: execution.id,
        provider: dispatch.provider,
        messageId: dispatch.messageId,
        sentAt,
        nextRunAt
      };
    } catch (error) {
      await Promise.all([
        RelatorioExecucaoModel.markFailure(execution.id, {
          errorMessage: error.message,
          finalizadoEm: new Date()
        }),
        RelatorioAgendamentoModel.markError({
          id: agendamento.id,
          errorMessage: error.message
        })
      ]);

      throw error;
    }
  }

  static async listExecutions({ id, usuario }) {
    if (!usuario || usuario.role !== "ADMIN") {
      throw new AppError("Apenas ADMIN pode executar relatorios.", 403);
    }
    return RelatorioExecucaoModel.findByAgendamentoId(id);
  }
}

module.exports = RelatorioExecucaoService;
