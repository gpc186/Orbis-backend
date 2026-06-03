const AppError = require("../../utils/appErrorUtils");
const { parseFiniteNumber } = require("../../utils/requestParsers");
const {
  validatePreviewPayload,
  validateSchedulePayload,
  validateDestinatarios
} = require("../../utils/reportValidation");
const AlertaService = require("../alertaService");
const ManutecaoService = require("../manutencaoService");
const RelatorioAgendamentoService = require("../relatorioAgendamentoService");
const RelatorioExecucaoService = require("../relatorioExecucaoService");
const SensorService = require("../sensorService");
const {
  mapManutencao,
  mapRelatorioAgendamento,
  mapSensor
} = require("./mappers");
const { assertWriteToolPermission } = require("./guards");
const {
  resolveAgendamentoTarget,
  resolveSensorTarget
} = require("./targetResolvers");

async function prepareWriteToolAction({ name, args, usuario }) {
  assertWriteToolPermission({ name, usuario });

  if (name === "criar_agendamento_relatorio") {
    const normalized = validateSchedulePayload(args);

    return {
      name,
      args: normalized,
      actionLabel: "Criar agendamento",
      summary: {
        nome: normalized.nome,
        assunto: normalized.assunto,
        emailsDestino: normalized.emailsDestino,
        periodo: normalized.periodo,
        secoes: normalized.filtros.secoes,
        agendamento: normalized.agendamento
      }
    };
  }

  if (name === "atualizar_agendamento_relatorio") {
    const agendamento = await resolveAgendamentoTarget({
      usuario,
      args,
      actionName: name,
      actionLabel: "Atualizar agendamento"
    });

    if (agendamento.kind === "disambiguation") {
      return agendamento;
    }

    const normalized = validateSchedulePayload(args);
    const alteracoes = [];

    if (agendamento.nome !== normalized.nome) alteracoes.push("nome");
    if ((agendamento.assunto || null) !== normalized.assunto) alteracoes.push("assunto");
    if (agendamento.frequencia !== normalized.agendamento.frequencia) alteracoes.push("frequencia");
    if (agendamento.hora !== normalized.agendamento.hora || agendamento.minuto !== normalized.agendamento.minuto) {
      alteracoes.push("horario");
    }
    if (agendamento.diaSemana !== normalized.agendamento.diaSemana) alteracoes.push("diaSemana");
    if (agendamento.diaMes !== normalized.agendamento.diaMes) alteracoes.push("diaMes");
    if (JSON.stringify(agendamento.periodo) !== JSON.stringify(normalized.periodo)) alteracoes.push("periodo");
    if (JSON.stringify(agendamento.filtros) !== JSON.stringify(normalized.filtros)) alteracoes.push("filtros");
    if (JSON.stringify(agendamento.secoes) !== JSON.stringify(normalized.filtros.secoes)) alteracoes.push("secoes");
    if (JSON.stringify((agendamento.destinatarios || []).map((item) => item.email)) !== JSON.stringify(normalized.emailsDestino)) {
      alteracoes.push("destinatarios");
    }

    return {
      name,
      args: {
        id: Number(agendamento.id),
        payload: normalized
      },
      actionLabel: "Atualizar agendamento",
      summary: {
        id: agendamento.id,
        nome: agendamento.nome,
        statusAtual: agendamento.status,
        descricaoAgendamento: agendamento.descricaoAgendamento,
        alteracoes
      }
    };
  }

  if (name === "reativar_agendamento_relatorio") {
    const agendamento = await resolveAgendamentoTarget({
      usuario,
      args,
      actionName: name,
      actionLabel: "Reativar agendamento"
    });

    if (agendamento.kind === "disambiguation") {
      return agendamento;
    }

    return {
      name,
      args: { id: Number(agendamento.id) },
      actionLabel: "Reativar agendamento",
      summary: {
        id: agendamento.id,
        nome: agendamento.nome,
        statusAtual: agendamento.status,
        proximoEnvioEm: agendamento.proximoEnvioEm
      }
    };
  }

  if (name === "pausar_agendamento_relatorio") {
    const agendamento = await resolveAgendamentoTarget({
      usuario,
      args,
      actionName: name,
      actionLabel: "Pausar agendamento"
    });

    if (agendamento.kind === "disambiguation") {
      return agendamento;
    }

    return {
      name,
      args: { id: Number(agendamento.id) },
      actionLabel: "Pausar agendamento",
      summary: {
        id: agendamento.id,
        nome: agendamento.nome,
        statusAtual: agendamento.status,
        descricaoAgendamento: agendamento.descricaoAgendamento,
        proximoEnvioEm: agendamento.proximoEnvioEm
      }
    };
  }

  if (name === "deletar_agendamento_relatorio") {
    const agendamento = await resolveAgendamentoTarget({
      usuario,
      args,
      actionName: name,
      actionLabel: "Deletar agendamento"
    });

    if (agendamento.kind === "disambiguation") {
      return agendamento;
    }

    return {
      name,
      args: { id: Number(agendamento.id) },
      actionLabel: "Deletar agendamento",
      summary: {
        id: agendamento.id,
        nome: agendamento.nome,
        statusAtual: agendamento.status,
        descricaoAgendamento: agendamento.descricaoAgendamento,
        destinatarios: Array.isArray(agendamento.destinatarios)
          ? agendamento.destinatarios.map((item) => item.email)
          : []
      }
    };
  }

  if (name === "executar_agendamento_relatorio_agora") {
    const agendamento = await resolveAgendamentoTarget({
      usuario,
      args,
      actionName: name,
      actionLabel: "Executar agendamento agora"
    });

    if (agendamento.kind === "disambiguation") {
      return agendamento;
    }

    return {
      name,
      args: { id: Number(agendamento.id) },
      actionLabel: "Executar agendamento agora",
      summary: {
        id: agendamento.id,
        nome: agendamento.nome,
        statusAtual: agendamento.status,
        destinatarios: Array.isArray(agendamento.destinatarios)
          ? agendamento.destinatarios.map((item) => item.email)
          : [],
        descricaoAgendamento: agendamento.descricaoAgendamento
      }
    };
  }

  if (name === "enviar_relatorio_agora") {
    const normalized = validatePreviewPayload(args);
    const emailsDestino = validateDestinatarios(args.emailsDestino, { max: 10 });

    return {
      name,
      args: {
        ...normalized,
        emailsDestino
      },
      actionLabel: "Enviar relatorio agora",
      summary: {
        nome: normalized.nome,
        assunto: normalized.assunto,
        emailsDestino,
        periodo: normalized.periodo,
        secoes: normalized.filtros.secoes
      }
    };
  }

  if (name === "criar_manutencao_por_alerta") {
    const alerta = await AlertaService.findById(args.alertaId);
    const observacao = String(args.observacao || "").trim();

    if (observacao.length < 3) {
      throw new AppError("Observacao nao e valida.", 400);
    }

    if (alerta.status === "RESOLVIDO" || alerta.status === "CANCELADO") {
      throw new AppError("Nao e possivel criar uma manutencao para um alerta encerrado.", 400);
    }

    const manutencaoEmAndamento = Array.isArray(alerta.manutencoes)
      && alerta.manutencoes.some((manutencao) => manutencao.status === "EM_ANDAMENTO");

    if (manutencaoEmAndamento) {
      throw new AppError("Ja existe uma manutencao em aberto para este alerta.", 400);
    }

    return {
      name,
      args: {
        alertaId: Number(args.alertaId),
        observacao
      },
      actionLabel: "Criar manutencao",
      summary: {
        alertaId: alerta.id,
        alertaTipo: alerta.tipo,
        maquinaNome: alerta.maquina?.nome || null,
        observacao,
        tecnicoExecutor: usuario.id
      }
    };
  }

  if (name === "atualizar_status_manutencao") {
    const manutencao = await ManutecaoService.findById(args.id);
    const observacao = args.observacao == null ? undefined : String(args.observacao).trim();
    const status = String(args.status || "").trim().toUpperCase();

    if (!ManutecaoService.STATUS_VALIDOS.includes(status)) {
      throw new AppError("Status de manutencao invalido.", 400);
    }

    if (manutencao.usuarioId !== usuario.id) {
      throw new AppError("Voce nao pode atualizar a manutencao de outro tecnico.", 403);
    }

    if (manutencao.status !== "EM_ANDAMENTO") {
      throw new AppError("Manutencao encerrada nao pode mais ser alterada.", 409);
    }

    if (observacao !== undefined && observacao.length > 0 && observacao.length < 3) {
      throw new AppError("Observacao nao e valida.", 400);
    }

    return {
      name,
      args: {
        id: Number(manutencao.id),
        dados: {
          status,
          ...(observacao ? { observacao } : {})
        }
      },
      actionLabel: "Atualizar manutencao",
      summary: {
        id: manutencao.id,
        alertaId: manutencao.alertaId,
        statusAtual: manutencao.status,
        novoStatus: status,
        observacaoNova: observacao || null
      }
    };
  }

  if (name === "atualizar_limites_sensor") {
    const sensor = await resolveSensorTarget({
      args,
      actionName: name,
      actionLabel: "Atualizar limites do sensor"
    });

    if (sensor.kind === "disambiguation") {
      return sensor;
    }

    const changedFields = {};
    const supportedFields = [
      "limiteTemperatura",
      "idealTemperatura",
      "limiteVibracao",
      "idealVibracao",
      "desvioMaximoTemp",
      "desvioMaximoVibra"
    ];

    for (const field of supportedFields) {
      if (args[field] !== undefined) {
        changedFields[field] = parseFiniteNumber(args[field], `Valor invalido para ${field}.`);
      }
    }

    if (Object.keys(changedFields).length === 0) {
      throw new AppError("Informe ao menos um limite do sensor para atualizar.", 400);
    }

    return {
      name,
      args: {
        id: Number(sensor.id),
        data: {
          tipo: sensor.tipo,
          status: sensor.status,
          maquinaId: sensor.maquinaId,
          limiteTemperatura: changedFields.limiteTemperatura ?? sensor.limiteTemperatura,
          idealTemperatura: changedFields.idealTemperatura ?? sensor.idealTemperatura,
          limiteVibracao: changedFields.limiteVibracao ?? sensor.limiteVibracao,
          idealVibracao: changedFields.idealVibracao ?? sensor.idealVibracao,
          desvioMaximoTemp: changedFields.desvioMaximoTemp ?? sensor.desvioMaximoTemp,
          desvioMaximoVibra: changedFields.desvioMaximoVibra ?? sensor.desvioMaximoVibra
        }
      },
      actionLabel: "Atualizar limites do sensor",
      summary: {
        id: sensor.id,
        tipo: sensor.tipo,
        maquinaId: sensor.maquinaId,
        maquinaNome: sensor.maquina?.nome || null,
        alteracoes: Object.keys(changedFields).map((field) => ({
          campo: field,
          valorAtual: sensor[field],
          novoValor: changedFields[field]
        }))
      }
    };
  }

  throw new AppError(`Tool de escrita nao suportada: ${name}`, 400);
}

async function executeWriteTool({ action, usuario }) {
  assertWriteToolPermission({ name: action.name, usuario });

  if (action.name === "criar_agendamento_relatorio") {
    const result = await RelatorioAgendamentoService.create({
      usuario,
      payload: action.args
    });

    return {
      message: "Agendamento criado com sucesso.",
      agendamento: mapRelatorioAgendamento(result)
    };
  }

  if (action.name === "atualizar_agendamento_relatorio") {
    const result = await RelatorioAgendamentoService.update({
      usuario,
      id: action.args.id,
      payload: action.args.payload
    });

    return {
      message: "Agendamento atualizado com sucesso.",
      agendamento: mapRelatorioAgendamento(result)
    };
  }

  if (action.name === "reativar_agendamento_relatorio") {
    const result = await RelatorioAgendamentoService.updateStatus({
      usuario,
      id: action.args.id,
      payload: { status: "ATIVO" }
    });

    return {
      message: "Agendamento reativado com sucesso.",
      agendamento: mapRelatorioAgendamento(result)
    };
  }

  if (action.name === "pausar_agendamento_relatorio") {
    const result = await RelatorioAgendamentoService.updateStatus({
      usuario,
      id: action.args.id,
      payload: { status: "PAUSADO" }
    });

    return {
      message: "Agendamento pausado com sucesso.",
      agendamento: mapRelatorioAgendamento(result)
    };
  }

  if (action.name === "deletar_agendamento_relatorio") {
    const result = await RelatorioAgendamentoService.delete({
      usuario,
      id: action.args.id
    });

    return {
      message: "Agendamento deletado com sucesso.",
      ...result
    };
  }

  if (action.name === "executar_agendamento_relatorio_agora") {
    const result = await RelatorioAgendamentoService.executeNow({
      usuario,
      id: action.args.id
    });

    return {
      message: "Agendamento executado com sucesso.",
      ...result
    };
  }

  if (action.name === "enviar_relatorio_agora") {
    const result = await RelatorioExecucaoService.executarManual({
      usuario,
      payload: action.args
    });

    return {
      message: "Relatorio enviado com sucesso.",
      ...result
    };
  }

  if (action.name === "criar_manutencao_por_alerta") {
    const result = await ManutecaoService.create({
      alertaId: action.args.alertaId,
      usuarioId: usuario.id,
      observacao: action.args.observacao
    });

    return {
      message: "Manutencao criada com sucesso.",
      manutencao: mapManutencao(result)
    };
  }

  if (action.name === "atualizar_status_manutencao") {
    const result = await ManutecaoService.update(action.args.id, usuario.id, {
      dados: action.args.dados
    });

    return {
      message: "Manutencao atualizada com sucesso.",
      manutencao: mapManutencao(result)
    };
  }

  if (action.name === "atualizar_limites_sensor") {
    const result = await SensorService.update(action.args.id, action.args.data);

    return {
      message: "Limites do sensor atualizados com sucesso.",
      sensor: mapSensor(result)
    };
  }

  throw new AppError(`Tool de escrita nao suportada: ${action.name}`, 400);
}

module.exports = {
  prepareWriteToolAction,
  executeWriteTool
};
