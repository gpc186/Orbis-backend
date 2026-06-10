const TIME_ZONE = "America/Sao_Paulo";

const PRIORIDADES_MANUTENCAO = ["BAIXA", "MEDIA", "ALTA", "URGENTE"];
const CUMPRIMENTO_AGENDAMENTO = {
  ANTECIPADA: "ANTECIPADA",
  NO_PRAZO: "NO_PRAZO",
  ATRASADA: "ATRASADA",
  NAO_APLICAVEL: "NAO_APLICAVEL"
};

function parseDate(value) {
  if (value == null || value === "") return null;

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeTitle(value, fallback) {
  const title = typeof value === "string" ? value.trim() : "";
  const normalized = title || fallback;

  if (!normalized || normalized.length < 3 || normalized.length > 120) {
    return null;
  }

  return normalized;
}

function normalizePriority(value, fallback = "MEDIA") {
  const normalized = String(value || fallback).trim().toUpperCase();
  return PRIORIDADES_MANUTENCAO.includes(normalized) ? normalized : null;
}

function buildMaintenanceTitle({ tipo, origem, maquinaNome }) {
  const nome = maquinaNome || "Maquina";

  if (origem === "PREDICAO") {
    return `Preventiva preditiva - ${nome}`;
  }

  if (tipo === "PREVENTIVA") {
    return `Manutencao preventiva - ${nome}`;
  }

  return `Manutencao corretiva - ${nome}`;
}

function getDatePartsInTimeZone(date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  const parts = formatter.formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day)
  };
}

function getDayOrdinal(date) {
  const parts = getDatePartsInTimeZone(date);
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / 86400000);
}

function calculateScheduleCompliance({ dataAgendada, concluidaEm, status }) {
  const scheduledAt = parseDate(dataAgendada);
  const finishedAt = parseDate(concluidaEm);

  if (status !== "RESOLVIDO" || !scheduledAt || !finishedAt) {
    return {
      cumprimentoAgendamento: CUMPRIMENTO_AGENDAMENTO.NAO_APLICAVEL,
      diasDesvioAgendamento: null
    };
  }

  const daysDiff = getDayOrdinal(finishedAt) - getDayOrdinal(scheduledAt);

  if (daysDiff < 0) {
    return {
      cumprimentoAgendamento: CUMPRIMENTO_AGENDAMENTO.ANTECIPADA,
      diasDesvioAgendamento: daysDiff
    };
  }

  if (daysDiff > 0) {
    return {
      cumprimentoAgendamento: CUMPRIMENTO_AGENDAMENTO.ATRASADA,
      diasDesvioAgendamento: daysDiff
    };
  }

  return {
    cumprimentoAgendamento: CUMPRIMENTO_AGENDAMENTO.NO_PRAZO,
    diasDesvioAgendamento: 0
  };
}

function enrichMaintenanceSchedule(item) {
  if (!item) return item;

  return {
    ...item,
    ...calculateScheduleCompliance({
      dataAgendada: item.dataAgendada,
      concluidaEm: item.concluidaEm,
      status: item.status
    })
  };
}

module.exports = {
  PRIORIDADES_MANUTENCAO,
  CUMPRIMENTO_AGENDAMENTO,
  parseDate,
  normalizeTitle,
  normalizePriority,
  buildMaintenanceTitle,
  calculateScheduleCompliance,
  enrichMaintenanceSchedule
};
