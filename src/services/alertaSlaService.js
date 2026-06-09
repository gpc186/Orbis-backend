const SLA_STATUS = Object.freeze({
  NO_PRAZO: "NO_PRAZO",
  EM_RISCO: "EM_RISCO",
  ATRASADO: "ATRASADO",
  CONCLUIDO_NO_PRAZO: "CONCLUIDO_NO_PRAZO",
  CONCLUIDO_ATRASADO: "CONCLUIDO_ATRASADO",
  NAO_APLICAVEL: "NAO_APLICAVEL"
});

const SLA_THRESHOLDS_MINUTES = Object.freeze({
  ALTA: Object.freeze({ atendimento: 30, resolucao: 240 }),
  MEDIA: Object.freeze({ atendimento: 120, resolucao: 720 }),
  BAIXA: Object.freeze({ atendimento: 480, resolucao: 2880 })
});

const RISK_THRESHOLD_PERCENT = 80;
const OPEN_STATUSES = new Set(["ATIVO", "EM_ANDAMENTO"]);

function toDate(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function diffMinutes(start, end) {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000));
}

function findFirstByDate(items = [], predicate = () => true) {
  if (!Array.isArray(items)) {
    return null;
  }

  return items
    .filter((item) => predicate(item) && toDate(item.criadoEm))
    .sort((a, b) => toDate(a.criadoEm) - toDate(b.criadoEm))[0] || null;
}

function getThresholds(criticidade) {
  return SLA_THRESHOLDS_MINUTES[criticidade] || SLA_THRESHOLDS_MINUTES.BAIXA;
}

function buildMetric({ inicio, concluidoEm, limiteMinutos, referenceDate, forceStatus }) {
  if (!inicio || forceStatus === SLA_STATUS.NAO_APLICAVEL) {
    return {
      limiteMinutos,
      limiteEm: inicio ? addMinutes(inicio, limiteMinutos) : null,
      concluidoEm: concluidoEm || null,
      minutosDecorridos: null,
      percentualConsumido: null,
      status: SLA_STATUS.NAO_APLICAVEL
    };
  }

  const fim = concluidoEm || referenceDate;
  const limiteEm = addMinutes(inicio, limiteMinutos);
  const minutosDecorridos = diffMinutes(inicio, fim);
  const percentualConsumido = Math.round((minutosDecorridos / limiteMinutos) * 100);

  let status;
  if (concluidoEm) {
    status = minutosDecorridos <= limiteMinutos
      ? SLA_STATUS.CONCLUIDO_NO_PRAZO
      : SLA_STATUS.CONCLUIDO_ATRASADO;
  } else if (minutosDecorridos > limiteMinutos) {
    status = SLA_STATUS.ATRASADO;
  } else if (percentualConsumido >= RISK_THRESHOLD_PERCENT) {
    status = SLA_STATUS.EM_RISCO;
  } else {
    status = SLA_STATUS.NO_PRAZO;
  }

  return {
    limiteMinutos,
    limiteEm,
    concluidoEm: concluidoEm || null,
    minutosDecorridos,
    percentualConsumido,
    status
  };
}

function getAtendimentoConcluidoEm(alerta) {
  const eventoAceito = findFirstByDate(alerta.eventos, (evento) => evento.tipo === "ACEITO");
  if (eventoAceito) {
    return toDate(eventoAceito.criadoEm);
  }

  const primeiraManutencao = findFirstByDate(alerta.manutencoes);
  return primeiraManutencao ? toDate(primeiraManutencao.criadoEm) : null;
}

function getResolucaoConcluidoEm(alerta) {
  const encerradoEm = toDate(alerta.encerradoEm);
  if (encerradoEm) {
    return encerradoEm;
  }

  const eventoResolvido = findFirstByDate(alerta.eventos, (evento) => evento.tipo === "RESOLVIDO");
  return eventoResolvido ? toDate(eventoResolvido.criadoEm) : null;
}

function calculateSla(alerta, { referenceDate = new Date() } = {}) {
  const inicio = toDate(alerta?.criadoEm);
  const criticidade = alerta?.maquina?.criticidade || alerta?.criticidade || "BAIXA";
  const thresholds = getThresholds(criticidade);
  const isCancelado = alerta?.status === "CANCELADO";
  const reference = toDate(referenceDate) || new Date();

  return {
    criticidade,
    atendimento: buildMetric({
      inicio,
      concluidoEm: getAtendimentoConcluidoEm(alerta || {}),
      limiteMinutos: thresholds.atendimento,
      referenceDate: reference,
      forceStatus: isCancelado ? SLA_STATUS.NAO_APLICAVEL : undefined
    }),
    resolucao: buildMetric({
      inicio,
      concluidoEm: getResolucaoConcluidoEm(alerta || {}),
      limiteMinutos: thresholds.resolucao,
      referenceDate: reference,
      forceStatus: isCancelado ? SLA_STATUS.NAO_APLICAVEL : undefined
    })
  };
}

function removeSlaSources(alerta) {
  const { eventos, manutencoes, ...publicAlert } = alerta;
  return publicAlert;
}

function attachSla(alerta, options = {}) {
  if (!alerta) {
    return alerta;
  }

  const base = options.stripSources ? removeSlaSources(alerta) : alerta;
  return {
    ...base,
    sla: calculateSla(alerta, options)
  };
}

function attachSlaToMany(alertas = [], options = {}) {
  return alertas.map((alerta) => attachSla(alerta, options));
}

function summarizeOpenSla(alertas = [], options = {}) {
  return alertas.reduce((summary, alerta) => {
    if (!OPEN_STATUSES.has(alerta.status)) {
      return summary;
    }

    const sla = calculateSla(alerta, options);

    if (sla.atendimento.status === SLA_STATUS.EM_RISCO) {
      summary.slaAtendimentoEmRisco += 1;
    }
    if (sla.atendimento.status === SLA_STATUS.ATRASADO) {
      summary.slaAtendimentoAtrasado += 1;
    }
    if (sla.resolucao.status === SLA_STATUS.EM_RISCO) {
      summary.slaResolucaoEmRisco += 1;
    }
    if (sla.resolucao.status === SLA_STATUS.ATRASADO) {
      summary.slaResolucaoAtrasado += 1;
    }

    return summary;
  }, {
    slaAtendimentoEmRisco: 0,
    slaAtendimentoAtrasado: 0,
    slaResolucaoEmRisco: 0,
    slaResolucaoAtrasado: 0
  });
}

module.exports = {
  SLA_STATUS,
  SLA_THRESHOLDS_MINUTES,
  RISK_THRESHOLD_PERCENT,
  calculateSla,
  attachSla,
  attachSlaToMany,
  summarizeOpenSla
};
