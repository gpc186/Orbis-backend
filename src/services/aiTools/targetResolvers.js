const AppError = require("../../utils/appErrorUtils");
const RelatorioAgendamentoService = require("../relatorioAgendamentoService");
const SensorService = require("../sensorService");
const {
  mapDisambiguationAgendamento,
  mapDisambiguationSensor
} = require("./mappers");

function buildDisambiguationResult({ entity, actionName, actionLabel, message, options }) {
  return {
    kind: "disambiguation",
    entity,
    actionName,
    actionLabel,
    message,
    options
  };
}

async function resolveAgendamentoTarget({ usuario, args, actionName, actionLabel }) {
  if (args?.id !== undefined && args?.id !== null && String(args.id).trim() !== "") {
    return await RelatorioAgendamentoService.findById({ usuario, id: args.id });
  }

  const email = String(args?.email || "").trim();

  if (!email) {
    throw new AppError("Informe o id ou o e-mail destinatario do agendamento.", 400);
  }

  const items = await RelatorioAgendamentoService.findByDestinatarioEmail({
    usuario,
    email,
    limit: 10
  });

  if (items.length === 0) {
    throw new AppError("Nenhum agendamento de relatorio encontrado para o e-mail informado.", 404);
  }

  if (items.length > 1) {
    return buildDisambiguationResult({
      entity: "relatorio_agendamento",
      actionName,
      actionLabel,
      message: `Encontrei mais de um agendamento de relatorio com o e-mail ${email}. Escolha qual deles voce quer usar.`,
      options: items.map(mapDisambiguationAgendamento)
    });
  }

  return items[0];
}

async function resolveSensorTarget({ args, actionName, actionLabel }) {
  if (args?.id !== undefined && args?.id !== null && String(args.id).trim() !== "") {
    return await SensorService.findById(args.id);
  }

  const tipo = String(args?.tipo || "").trim();

  if (!tipo) {
    throw new AppError("Informe o id ou o tipo do sensor.", 400);
  }

  const result = await SensorService.findByTipo({
    tipo,
    limit: 10
  });

  if (result.total === 0) {
    throw new AppError("Nenhum sensor encontrado para o tipo informado.", 404);
  }

  if (result.total > 1) {
    return buildDisambiguationResult({
      entity: "sensor",
      actionName,
      actionLabel,
      message: `Encontrei mais de um sensor com o tipo ${tipo}. Escolha qual deles voce quer usar.`,
      options: result.dados.map(mapDisambiguationSensor)
    });
  }

  return result.dados[0];
}

module.exports = {
  buildDisambiguationResult,
  resolveAgendamentoTarget,
  resolveSensorTarget
};
