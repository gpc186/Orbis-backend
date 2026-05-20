const AppError = require("../utils/appErrorUtils");
const RelatorioAgendamentoModel = require("../models/relatorioAgendamentoModel");
const RelatorioRendererService = require("./relatorioRendererService");
const RelatorioExecucaoService = require("./relatorioExecucaoService");
const {
  validatePreviewPayload,
  validateSchedulePayload,
  validateStatusPayload
} = require("../utils/reportValidation");
const {
  buildScheduleDescription,
  computeNextRun,
  formatReportDateTime
} = require("../utils/reportScheduleUtils");

class RelatorioAgendamentoService {
  static assertAdmin(usuario) {
    if (!usuario || usuario.role !== "ADMIN") {
      throw new AppError("Apenas ADMIN pode gerenciar relatorios.", 403);
    }
  }

  static mapResponse(agendamento) {
    return {
      ...agendamento,
      proximoEnvioEm: formatReportDateTime(agendamento.proximoEnvioEm),
      ultimoEnvioEm: formatReportDateTime(agendamento.ultimoEnvioEm),
      ultimoSucessoEm: formatReportDateTime(agendamento.ultimoSucessoEm),
      criadoEm: formatReportDateTime(agendamento.criadoEm),
      atualizadoEm: formatReportDateTime(agendamento.atualizadoEm),
      descricaoAgendamento: buildScheduleDescription({
        frequencia: agendamento.frequencia,
        hora: agendamento.hora,
        minuto: agendamento.minuto,
        diaSemana: agendamento.diaSemana,
        diaMes: agendamento.diaMes
      })
    };
  }

  static async preview({ usuario, payload }) {
    this.assertAdmin(usuario);

    const normalized = validatePreviewPayload(payload);
    const rendered = await RelatorioRendererService.render(normalized);

    return {
      subject: rendered.subject,
      html: rendered.html,
      periodoLabel: rendered.periodoLabel,
      data: rendered.data
    };
  }

  static async create({ usuario, payload }) {
    this.assertAdmin(usuario);

    const normalized = validateSchedulePayload(payload);
    const nextRunAt = computeNextRun(normalized.agendamento);

    const agendamento = await RelatorioAgendamentoModel.create({
      data: {
        nome: normalized.nome,
        criadoPorId: usuario.id,
        status: "ATIVO",
        frequencia: normalized.agendamento.frequencia,
        hora: normalized.agendamento.hora,
        minuto: normalized.agendamento.minuto,
        diaSemana: normalized.agendamento.diaSemana,
        diaMes: normalized.agendamento.diaMes,
        assunto: normalized.assunto,
        tipoPeriodo: normalized.periodo.tipo,
        periodo: normalized.periodo,
        filtros: normalized.filtros,
        secoes: normalized.filtros.secoes,
        proximoEnvioEm: nextRunAt
      },
      emailsDestino: normalized.emailsDestino
    });

    return this.mapResponse(agendamento);
  }

  static async list({ usuario }) {
    this.assertAdmin(usuario);
    const items = await RelatorioAgendamentoModel.findAll();
    return items.map((item) => this.mapResponse(item));
  }

  static async findById({ usuario, id }) {
    this.assertAdmin(usuario);
    const agendamento = await RelatorioAgendamentoModel.findById(id);

    if (!agendamento) {
      throw new AppError("Agendamento de relatorio nao encontrado.", 404);
    }

    return this.mapResponse(agendamento);
  }

  static async update({ usuario, id, payload }) {
    this.assertAdmin(usuario);

    const current = await RelatorioAgendamentoModel.findById(id);
    if (!current) {
      throw new AppError("Agendamento de relatorio nao encontrado.", 404);
    }

    const normalized = validateSchedulePayload(payload);
    const nextRunAt = computeNextRun(normalized.agendamento);

    const updated = await RelatorioAgendamentoModel.update({
      id,
      data: {
        nome: normalized.nome,
        assunto: normalized.assunto,
        frequencia: normalized.agendamento.frequencia,
        hora: normalized.agendamento.hora,
        minuto: normalized.agendamento.minuto,
        diaSemana: normalized.agendamento.diaSemana,
        diaMes: normalized.agendamento.diaMes,
        tipoPeriodo: normalized.periodo.tipo,
        periodo: normalized.periodo,
        filtros: normalized.filtros,
        secoes: normalized.filtros.secoes,
        proximoEnvioEm: nextRunAt,
        status: current.status === "PAUSADO" ? "PAUSADO" : "ATIVO"
      },
      emailsDestino: normalized.emailsDestino
    });

    return this.mapResponse(updated);
  }

  static async updateStatus({ usuario, id, payload }) {
    this.assertAdmin(usuario);
    const normalized = validateStatusPayload(payload);
    const current = await RelatorioAgendamentoModel.findById(id);

    if (!current) {
      throw new AppError("Agendamento de relatorio nao encontrado.", 404);
    }

    const data = {
      status: normalized.status,
      lockedAt: null
    };

    if (normalized.status === "ATIVO") {
      data.proximoEnvioEm = computeNextRun({
        frequencia: current.frequencia,
        hora: current.hora,
        minuto: current.minuto,
        diaSemana: current.diaSemana,
        diaMes: current.diaMes
      });
      data.ultimoErroEm = null;
    }

    const agendamento = await RelatorioAgendamentoModel.updateStatus(id, data);
    return this.mapResponse(agendamento);
  }

  static async delete({ usuario, id }) {
    this.assertAdmin(usuario);

    const current = await RelatorioAgendamentoModel.findById(id);
    if (!current) {
      throw new AppError("Agendamento de relatorio nao encontrado.", 404);
    }

    await RelatorioAgendamentoModel.delete(id);

    return {
      id: Number(id),
      nome: current.nome
    };
  }

  static async executeNow({ usuario, id }) {
    this.assertAdmin(usuario);
    return RelatorioExecucaoService.executarAgendamento(id, {
      updateSchedule: false,
      tipoExecucao: "MANUAL"
    });
  }

  for (const item of dueItems) {
  const locked = await RelatorioAgendamentoModel.tryLock(item.id, new Date());
  if (!locked) continue;

  try {
    const result = await RelatorioExecucaoService.executarAgendamento(item.id);
    processed.push({
      agendamentoId: item.id,
      status: "ENVIADO",
      result
    });
  } catch (error) {
    processed.push({
      agendamentoId: item.id,
      status: "FALHOU",
      error: error.message
    });
  } finally {
    await RelatorioAgendamentoModel.clearLock(item.id);
  }
}
}

module.exports = RelatorioAgendamentoService;
