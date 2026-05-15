const AppError = require("../utils/appErrorUtils");
const RelatorioAgendamentoModel = require("../models/relatorioAgendamentoModel");
const RelatorioExecucaoModel = require("../models/relatorioExecucaoModel");
const RelatorioRendererService = require("./relatorioRendererService");
const RelatorioDispatchService = require("./relatorioDispatchService");
const { computeNextRun } = require("../utils/reportScheduleUtils");
const { validatePreviewPayload } = require("../utils/reportValidation");
const { normalizeEmails, isValidEmail } = require("../utils/emailValidation");

class RelatorioExecucaoService {
  static assertAdmin(usuario) {
    if (!usuario || usuario.role !== "ADMIN") {
      throw new AppError("Apenas ADMIN pode executar relatorios.", 403);
    }
  }

  static validateDestinatarios(emailsDestino) {
    const destinatarios = normalizeEmails(emailsDestino);

    if (!destinatarios.length) {
      throw new AppError("Informe os emails de destino para envio manual.", 400);
    }

    if (destinatarios.length > 10) {
      throw new AppError("Maximo de 10 destinatarios por envio.", 400);
    }

    const emailInvalido = destinatarios.find((email) => !isValidEmail(email));
    if (emailInvalido) {
      throw new AppError(`Email invalido: ${emailInvalido}`, 400);
    }

    return destinatarios;
  }

  static async executarManual({ usuario, payload }) {
    this.assertAdmin(usuario);

    const normalized = validatePreviewPayload(payload);
    const emailsDestino = this.validateDestinatarios(payload.emailsDestino);

    const rendered = await RelatorioRendererService.render(normalized);
    const sentAt = new Date();

    const execution = await RelatorioExecucaoModel.create({
      agendamentoId: null,
      tipoExecucao: "MANUAL",
      status: "PROCESSANDO",
      assunto: rendered.subject,
      emailsDestino,
      periodoSnapshot: normalized.periodo,
      filtrosSnapshot: normalized.filtros,
      secoes: normalized.filtros.secoes
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
        finalizadoEm: sentAt
      });

      return {
        execucaoId: execution.id,
        provider: dispatch.provider,
        messageId: dispatch.messageId,
        subject: rendered.subject,
        enviadoPara: emailsDestino,
        quantidadeDestinatarios: emailsDestino.length,
        enviadoEm: sentAt.toISOString(),
        origemTemplate: "backend"
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
      secoes: agendamento.secoes || agendamento.filtros?.secoes || null
    });

    try {
      const rendered = await RelatorioRendererService.render({
        nome: agendamento.nome,
        assunto: agendamento.assunto,
        periodo: agendamento.periodo,
        filtros: {
          ...agendamento.filtros,
          secoes: Array.isArray(agendamento.secoes)
            ? agendamento.secoes
            : agendamento.filtros?.secoes
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
