const AppError = require("../utils/appErrorUtils");
const RelatorioAgendamentoModel = require("../models/relatorioAgendamentoModel");
const RelatorioExecucaoModel = require("../models/relatorioExecucaoModel");
const RelatorioRendererService = require("./relatorioRendererService");
const { computeNextRun, formatReportDateTime } = require("../utils/reportScheduleUtils");
const { validatePreviewPayload } = require("../utils/reportValidation");
const { normalizeEmails, isValidEmail } = require("../utils/emailValidation");
const EmailService = require("./emailService");

class RelatorioExecucaoService {
  static mapExecutionResponse(execucao) {
    return {
      ...execucao,
      iniciadoEm: formatReportDateTime(execucao.iniciadoEm),
      finalizadoEm: formatReportDateTime(execucao.finalizadoEm)
    };
  }

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

      const dispatch = await EmailService.send({ to: emailsDestino, subject: rendered.subject, html: rendered.html, text: rendered.text })

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
        enviadoEm: formatReportDateTime(sentAt),
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

  static async executarAgendamento(agendamentoId, options = {}) {
    const { updateSchedule = true, tipoExecucao = "AGENDADO" } = options;
    const agendamento = await RelatorioAgendamentoModel.findById(agendamentoId);

    if (!agendamento) {
      throw new AppError("Agendamento de relatorio nao encontrado.", 404);
    }

    const emailsDestino = agendamento.destinatarios.map((item) => item.email);

    const execution = await RelatorioExecucaoModel.create({
      agendamentoId: agendamento.id,
      tipoExecucao,
      status: "PROCESSANDO",
      assunto: agendamento.assunto || agendamento.nome,
      emailsDestino,
      periodoSnapshot: agendamento.periodo,
      filtrosSnapshot: agendamento.filtros,
      secoes: agendamento.secoes || agendamento.filtros?.secoes || null
    });

    let attemptedAt = null;

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

      attemptedAt = new Date();

      const dispatch = await EmailService.send({ to: emailsDestino, subject: rendered.subject, html: rendered.html, text: rendered.text })

      let nextRunAt = agendamento.proximoEnvioEm;
      const updates = [
        RelatorioExecucaoModel.markSuccess(execution.id, {
          provider: dispatch.provider,
          messageId: dispatch.messageId,
          finalizadoEm: attemptedAt
        })
      ];

      if (updateSchedule) {
        nextRunAt = computeNextRun(
          {
            frequencia: agendamento.frequencia,
            hora: agendamento.hora,
            minuto: agendamento.minuto,
            diaSemana: agendamento.diaSemana,
            diaMes: agendamento.diaMes
          },
          attemptedAt
        );

        updates.push(
          RelatorioAgendamentoModel.markScheduledSuccess({
            id: agendamento.id,
            sentAt: attemptedAt,
            nextRunAt
          })
        );
      } else {
        updates.push(
          RelatorioAgendamentoModel.markExecutionSuccess({
            id: agendamento.id,
            sentAt: attemptedAt
          })
        );
      }

      await Promise.all(updates);

      return {
        execucaoId: execution.id,
        provider: dispatch.provider,
        messageId: dispatch.messageId,
        sentAt: formatReportDateTime(attemptedAt),
        nextRunAt: formatReportDateTime(nextRunAt),
        tipoExecucao
      };
    } catch (error) {
      const finalizedAt = new Date();
      const updates = [
        RelatorioExecucaoModel.markFailure(execution.id, {
          errorMessage: error.message,
          finalizadoEm: finalizedAt
        })
      ];

      if (updateSchedule) {
        updates.push(
          RelatorioAgendamentoModel.markScheduledError({
            id: agendamento.id,
            errorMessage: error.message,
            attemptedAt
          })
        );
      } else {
        updates.push(
          RelatorioAgendamentoModel.markExecutionFailure({
            id: agendamento.id,
            errorMessage: error.message,
            attemptedAt
          })
        );
      }

      await Promise.all(updates);

      throw error;
    }
  }

  static async listExecutions({ id, usuario }) {
    if (!usuario || usuario.role !== "ADMIN") {
      throw new AppError("Apenas ADMIN pode executar relatorios.", 403);
    }
    const execucoes = await RelatorioExecucaoModel.findByAgendamentoId(id);
    return execucoes.map((execucao) => this.mapExecutionResponse(execucao));
  }
}

module.exports = RelatorioExecucaoService;
