const RelatorioReadModel = require("../models/relatorioReadModel");
const RelatorioPayloadMapper = require("../mappers/relatorioPayloadMapper");
const { REPORT_TIMEZONE } = require("../utils/reportScheduleUtils");

function toNumberMap(parts) {
  return parts.reduce((acc, part) => {
    if (part.type !== "literal") {
      acc[part.type] = Number(part.value);
    }
    return acc;
  }, {});
}

const reportDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: REPORT_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

const reportDateTimeFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: REPORT_TIMEZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit"
});

const publicDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: REPORT_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

function toUtcDate(parts) {
  return new Date(Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour || 0,
    parts.minute || 0,
    parts.second || 0,
    0
  ));
}

function getReportDateParts(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  return toNumberMap(reportDateFormatter.formatToParts(value));
}

function getReportDateTimeParts(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  return toNumberMap(reportDateTimeFormatter.formatToParts(value));
}

function zonedDateTimeToUtc(parts) {
  let guess = toUtcDate(parts);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const zoned = getReportDateTimeParts(guess);
    const diffMs = toUtcDate(parts).getTime() - toUtcDate(zoned).getTime();

    if (diffMs === 0) {
      return new Date(guess.getTime() + (parts.millisecond || 0));
    }

    guess = new Date(guess.getTime() + diffMs);
  }

  return new Date(guess.getTime() + (parts.millisecond || 0));
}

function addDaysToReportDate(localDate, days) {
  const date = new Date(Date.UTC(localDate.year, localDate.month - 1, localDate.day + days));

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate()
  };
}

function startOfReportDay(date) {
  const parts = getReportDateParts(date);
  return zonedDateTimeToUtc({ ...parts, hour: 0, minute: 0, second: 0, millisecond: 0 });
}

function endOfReportDay(date) {
  const parts = getReportDateParts(date);
  return zonedDateTimeToUtc({ ...parts, hour: 23, minute: 59, second: 59, millisecond: 999 });
}

function formatReportDateLabel(date) {
  return publicDateFormatter.format(date);
}

class RelatorioDataService {
  static resolveDateRange(periodo) {
    if (periodo.tipo === "RELATIVE_DAYS") {
      const valor = Number(periodo.valor || 30);
      const endParts = getReportDateParts(new Date());
      const startParts = addDaysToReportDate(endParts, -(valor - 1));

      return {
        start: zonedDateTimeToUtc({ ...startParts, hour: 0, minute: 0, second: 0, millisecond: 0 }),
        end: zonedDateTimeToUtc({ ...endParts, hour: 23, minute: 59, second: 59, millisecond: 999 }),
        label: `${valor} dias`
      };
    }

    const start = startOfReportDay(periodo.inicio);
    const end = endOfReportDay(periodo.fim);

    return {
      start,
      end,
      label: `${formatReportDateLabel(start)} ate ${formatReportDateLabel(end)}`
    };
  }

  static async collect({ periodo, filtros }) {
    const range = this.resolveDateRange(periodo);
    const secoes = filtros.secoes || [];
    const includeResumo = secoes.includes("resumo");
    const includeDesempenho = secoes.includes("desempenho");
    const includeSensores = secoes.includes("sensores");
    const includeChamados = secoes.includes("chamados");
    const includeHistoricoTendencia = secoes.includes("historicoTendencia");

    const [
      maquinasAtivas,
      maquinasAltaImportancia,
      integridadeMediaAgg,
      chamadosAbertos,
      statusDasMaquinas,
      maquinasPorImportancia,
      integridadePorSetor,
      sensores,
      chamados,
      historicoTendencia
    ] = await Promise.all([
      includeResumo ? RelatorioReadModel.countMaquinasAtivas({ filtros }) : 0,
      includeResumo ? RelatorioReadModel.countMaquinasAltaImportancia({ filtros }) : 0,
      includeResumo ? RelatorioReadModel.calculateIntegridadeMedia({ filtros }) : null,
      includeResumo ? RelatorioReadModel.countChamadosAbertos({ filtros }) : 0,
      includeDesempenho ? RelatorioReadModel.findStatusDasMaquinas({ filtros }) : null,
      includeDesempenho ? RelatorioReadModel.countMaquinasPorCriticidade({ filtros }) : null,
      includeDesempenho ? RelatorioReadModel.findIntegridadePorSetor({ filtros }) : [],
      includeSensores ? RelatorioReadModel.countSensoresPorStatus({ filtros }) : null,
      includeChamados ? RelatorioReadModel.findChamados({ filtros, range }) : [],
      includeHistoricoTendencia ? RelatorioReadModel.findHistoricoTendencia({ filtros, range }) : []
    ]);

    return RelatorioPayloadMapper.build({
      periodoLabel: range.label,
      secoes,
      maquinasAtivas,
      maquinasAltaImportancia,
      integridadeMedia: integridadeMediaAgg?._avg?.integridade || 0,
      chamadosAbertos,
      statusDasMaquinas,
      maquinasPorImportancia,
      integridadePorSetor,
      sensores,
      chamados,
      historicoTendencia
    });
  }
}

module.exports = RelatorioDataService;
