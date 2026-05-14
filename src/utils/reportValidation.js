const AppError = require("./appErrorUtils");

const FREQUENCIAS = ["DIARIO", "SEMANAL", "MENSAL"];
const STATUS_AGENDAMENTO = ["ATIVO", "PAUSADO"];
const PERIOD_TYPES = ["RELATIVE_DAYS", "CUSTOM_RANGE"];

function normalizeEmails(emailsDestino) {
  if (!emailsDestino) return [];

  const rawList = Array.isArray(emailsDestino)
    ? emailsDestino
    : String(emailsDestino)
        .split(",")
        .map((value) => value.trim());

  const unique = [...new Set(rawList.map((value) => String(value || "").trim().toLowerCase()))];
  return unique.filter(Boolean);
}

function assertValidEmails(emails) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emails.length) {
    throw new AppError("Informe ao menos um email de destino.", 400);
  }

  const invalid = emails.find((email) => !regex.test(email));
  if (invalid) {
    throw new AppError(`Email invalido: ${invalid}`, 400);
  }
}

function normalizeIdList(values) {
  if (!Array.isArray(values)) return [];

  return values
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);
}

function validatePeriodo(periodo = {}) {
  const tipo = String(periodo.tipo || "RELATIVE_DAYS").toUpperCase();

  if (!PERIOD_TYPES.includes(tipo)) {
    throw new AppError("Tipo de periodo invalido.", 400);
  }

  if (tipo === "RELATIVE_DAYS") {
    const valor = Number(periodo.valor || 30);
    if (!Number.isInteger(valor) || valor <= 0 || valor > 365) {
      throw new AppError("Periodo relativo invalido.", 400);
    }

    return { tipo, valor };
  }

  const inicio = new Date(periodo.inicio);
  const fim = new Date(periodo.fim);

  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) {
    throw new AppError("Periodo customizado invalido.", 400);
  }

  if (inicio > fim) {
    throw new AppError("A data inicial nao pode ser maior que a final.", 400);
  }

  return {
    tipo,
    inicio: inicio.toISOString(),
    fim: fim.toISOString()
  };
}

function validateFiltros(filtros = {}) {
  return {
    maquinasIds: normalizeIdList(filtros.maquinasIds),
    sensoresIds: normalizeIdList(filtros.sensoresIds),
    usuariosIds: normalizeIdList(filtros.usuariosIds),
    entidades: Array.isArray(filtros.entidades)
      ? [...new Set(filtros.entidades.map((value) => String(value).trim().toLowerCase()).filter(Boolean))]
      : ["resumo", "maquinas", "alertas"]
  };
}

function validateAgendamento(agendamento = {}) {
  const frequencia = String(agendamento.frequencia || "").toUpperCase();
  const timezone = String(agendamento.timezone || "America/Sao_Paulo").trim();
  const hora = Number(agendamento.hora);
  const minuto = Number(agendamento.minuto ?? 0);
  const diaSemana = agendamento.diaSemana == null ? null : Number(agendamento.diaSemana);
  const diaMes = agendamento.diaMes == null ? null : Number(agendamento.diaMes);

  if (!FREQUENCIAS.includes(frequencia)) {
    throw new AppError("Frequencia de agendamento invalida.", 400);
  }

  if (!Number.isInteger(hora) || hora < 0 || hora > 23) {
    throw new AppError("Hora invalida para o agendamento.", 400);
  }

  if (!Number.isInteger(minuto) || minuto < 0 || minuto > 59) {
    throw new AppError("Minuto invalido para o agendamento.", 400);
  }

  if (frequencia === "SEMANAL" && (!Number.isInteger(diaSemana) || diaSemana < 0 || diaSemana > 6)) {
    throw new AppError("Dia da semana invalido para agendamento semanal.", 400);
  }

  if (frequencia === "MENSAL" && (!Number.isInteger(diaMes) || diaMes < 1 || diaMes > 31)) {
    throw new AppError("Dia do mes invalido para agendamento mensal.", 400);
  }

  return {
    frequencia,
    timezone,
    hora,
    minuto,
    diaSemana,
    diaMes
  };
}

function validateSchedulePayload(payload = {}) {
  const nome = String(payload.nome || "").trim();
  const assunto = payload.assunto == null ? null : String(payload.assunto).trim();
  const emailsDestino = normalizeEmails(payload.emailsDestino);

  if (nome.length < 3) {
    throw new AppError("Nome do relatorio invalido.", 400);
  }

  if (assunto && assunto.length < 3) {
    throw new AppError("Assunto invalido.", 400);
  }

  assertValidEmails(emailsDestino);

  return {
    nome,
    assunto,
    emailsDestino,
    periodo: validatePeriodo(payload.periodo),
    filtros: validateFiltros(payload.filtros),
    agendamento: validateAgendamento(payload.agendamento)
  };
}

function validatePreviewPayload(payload = {}) {
  const assunto = payload.assunto == null ? null : String(payload.assunto).trim();

  if (assunto && assunto.length < 3) {
    throw new AppError("Assunto invalido.", 400);
  }

  return {
    nome: String(payload.nome || "Relatorio Operacional").trim(),
    assunto,
    periodo: validatePeriodo(payload.periodo),
    filtros: validateFiltros(payload.filtros)
  };
}

function validateStatusPayload(payload = {}) {
  const status = String(payload.status || "").toUpperCase();

  if (!STATUS_AGENDAMENTO.includes(status)) {
    throw new AppError("Status do agendamento invalido.", 400);
  }

  return { status };
}

module.exports = {
  normalizeEmails,
  validateAgendamento,
  validateFiltros,
  validatePeriodo,
  validatePreviewPayload,
  validateSchedulePayload,
  validateStatusPayload
};
