const UsuarioService = require("../usuarioService");
const MaquinaService = require("../maquinaService");
const SensorService = require("../sensorService");
const AlertaService = require("../alertaService");
const ManutecaoService = require("../manutencaoService");
const RelatorioAgendamentoService = require("../relatorioAgendamentoService");
const RelatorioExecucaoService = require("../relatorioExecucaoService");
const { validatePreviewPayload } = require("../../utils/reportValidation");
const AppError = require("../../utils/appErrorUtils");

const tools = [
  {
    type: "function",
    function: {
      name: "buscar_usuario_por_id",
      description: "Busca um usuario pelo ID e informa dados basicos de perfil e status",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "integer",
            description: "ID do usuario"
          }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "buscar_usuario_por_nome",
      description: "Busca usuarios por nome completo ou parcial e informa dados basicos de perfil e status",
      parameters: {
        type: "object",
        properties: {
          nome: {
            type: "string",
            description: "Nome completo ou parcial do usuario"
          },
          somenteAtivos: {
            type: "boolean",
            description: "Se true, retorna apenas usuarios ativos"
          },
          role: {
            type: "string",
            description: "Filtra por role, usando ADMIN ou TECNICO"
          },
          limite: {
            type: "integer",
            description: "Quantidade maxima de usuarios retornados"
          }
        },
        required: ["nome"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "listar_tecnicos",
      description: "Lista tecnicos do sistema e pode filtrar por ativos",
      parameters: {
        type: "object",
        properties: {
          nome: {
            type: "string",
            description: "Nome completo ou parcial do tecnico para filtrar a listagem"
          },
          somenteAtivos: {
            type: "boolean",
            description: "Se true, retorna apenas tecnicos ativos"
          },
          limite: {
            type: "integer",
            description: "Quantidade maxima de tecnicos retornados"
          }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "buscar_sensor_por_id",
      description: "Busca um sensor pelo ID e informa status e maquina vinculada",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "integer",
            description: "ID do sensor"
          }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "buscar_sensor_por_tipo",
      description: "Busca sensores por tipo, com filtros opcionais por maquina e status",
      parameters: {
        type: "object",
        properties: {
          tipo: {
            type: "string",
            description: "Tipo completo ou parcial do sensor"
          },
          maquinaId: {
            type: "integer",
            description: "ID opcional da maquina para restringir a busca"
          },
          status: {
            type: "string",
            description: "Status opcional do sensor, como ONLINE, OFFLINE ou INATIVO"
          },
          limite: {
            type: "integer",
            description: "Quantidade maxima de sensores retornados"
          }
        },
        required: ["tipo"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "buscar_alerta_por_id",
      description: "Busca um alerta pelo ID com sensor, maquina, tecnico e eventos relacionados",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "integer",
            description: "ID do alerta"
          }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "buscar_alertas_ativos",
      description: "Lista os alertas ativos mais recentes do sistema",
      parameters: {
        type: "object",
        properties: {
          limite: {
            type: "integer",
            description: "Quantidade maxima de alertas retornados"
          }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "buscar_eventos_por_alerta",
      description: "Busca a linha do tempo de eventos de um alerta especifico",
      parameters: {
        type: "object",
        properties: {
          alertaId: {
            type: "integer",
            description: "ID do alerta"
          },
          limite: {
            type: "integer",
            description: "Quantidade maxima de eventos retornados"
          }
        },
        required: ["alertaId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "buscar_alertas_por_maquina",
      description: "Busca alertas de uma maquina especifica, com opcao de mostrar apenas os ativos",
      parameters: {
        type: "object",
        properties: {
          maquinaId: {
            type: "integer",
            description: "ID da maquina"
          },
          somenteAtivos: {
            type: "boolean",
            description: "Se true, retorna apenas alertas ativos"
          },
          limite: {
            type: "integer",
            description: "Quantidade maxima de alertas retornados"
          }
        },
        required: ["maquinaId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "buscar_alertas_por_tecnico",
      description: "Busca alertas associados a um tecnico especifico, com opcao de mostrar apenas os ativos",
      parameters: {
        type: "object",
        properties: {
          tecnicoId: {
            type: "integer",
            description: "ID do tecnico"
          },
          somenteAtivos: {
            type: "boolean",
            description: "Se true, retorna apenas alertas ativos"
          },
          limite: {
            type: "integer",
            description: "Quantidade maxima de alertas retornados"
          }
        },
        required: ["tecnicoId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "buscar_manutencao_por_id",
      description: "Busca uma manutencao pelo ID com alerta e tecnico vinculados",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "integer",
            description: "ID da manutencao"
          }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "buscar_manutencoes_por_alerta",
      description: "Busca as manutencoes associadas a um alerta especifico",
      parameters: {
        type: "object",
        properties: {
          alertaId: {
            type: "integer",
            description: "ID do alerta"
          },
          limite: {
            type: "integer",
            description: "Quantidade maxima de manutencoes retornadas"
          }
        },
        required: ["alertaId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "buscar_tecnico_por_nome",
      description: "Busca tecnicos pelo nome completo ou parcial e informa se estao ativos",
      parameters: {
        type: "object",
        properties: {
          nome: {
            type: "string",
            description: "Nome completo ou parcial do tecnico"
          },
          somenteAtivos: {
            type: "boolean",
            description: "Se true, retorna apenas tecnicos ativos"
          },
          limite: {
            type: "integer",
            description: "Quantidade maxima de tecnicos retornados"
          }
        },
        required: ["nome"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "buscar_tecnico_por_id",
      description: "Busca um tecnico pelo ID e informa se esta ativo",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "integer",
            description: "ID do tecnico"
          }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "buscar_maquina_por_nome",
      description: "Busca maquinas pelo nome completo ou parcial e informa status operacional basico",
      parameters: {
        type: "object",
        properties: {
          nome: {
            type: "string",
            description: "Nome completo ou parcial da maquina"
          },
          somenteAtivas: {
            type: "boolean",
            description: "Se true, retorna apenas maquinas ativas"
          },
          limite: {
            type: "integer",
            description: "Quantidade maxima de maquinas retornadas"
          }
        },
        required: ["nome"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "buscar_maquina_por_id",
      description: "Busca uma maquina pelo ID e informa status operacional basico",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "integer",
            description: "ID da maquina"
          }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "buscar_maquinas_criticas",
      description: "Lista as maquinas mais criticas pelo menor indice de integridade",
      parameters: {
        type: "object",
        properties: {
          limite: {
            type: "integer",
            description: "Quantidade maxima de maquinas retornadas"
          }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "listar_sensores_por_maquina",
      description: "Lista sensores de uma maquina especifica, com filtro opcional por status",
      parameters: {
        type: "object",
        properties: {
          maquinaId: {
            type: "integer",
            description: "ID da maquina"
          },
          status: {
            type: "string",
            description: "Status opcional do sensor, como ONLINE, OFFLINE ou INATIVO"
          },
          limite: {
            type: "integer",
            description: "Quantidade maxima de sensores retornados"
          }
        },
        required: ["maquinaId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "buscar_sensores_offline",
      description: "Lista sensores offline recentes com identificacao minima da maquina",
      parameters: {
        type: "object",
        properties: {
          limite: {
            type: "integer",
            description: "Quantidade maxima de sensores retornados"
          }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "buscar_maquina_detalhada_por_id",
      description: "Busca uma maquina pelo ID com sensores e alertas ativos relacionados",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "integer",
            description: "ID da maquina"
          }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "buscar_maquinas_em_alerta",
      description: "Lista maquinas que possuem ao menos um alerta ativo no momento",
      parameters: {
        type: "object",
        properties: {
          limite: {
            type: "integer",
            description: "Quantidade maxima de maquinas retornadas"
          }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "listar_agendamentos_relatorio",
      description: "Lista os agendamentos de relatorio com status, frequencia e proximo envio",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "buscar_agendamento_relatorio_por_id",
      description: "Busca um agendamento de relatorio pelo ID com seus destinatarios e configuracoes",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "integer",
            description: "ID do agendamento de relatorio"
          }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "listar_execucoes_relatorio",
      description: "Lista as execucoes de um agendamento de relatorio especifico",
      parameters: {
        type: "object",
        properties: {
          agendamentoId: {
            type: "integer",
            description: "ID do agendamento de relatorio"
          }
        },
        required: ["agendamentoId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "pausar_agendamento_relatorio",
      description: "Pausa um agendamento de relatorio especifico",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "integer",
            description: "ID do agendamento de relatorio"
          }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "deletar_agendamento_relatorio",
      description: "Deleta um agendamento de relatorio especifico",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "integer",
            description: "ID do agendamento de relatorio"
          }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "executar_agendamento_relatorio_agora",
      description: "Executa imediatamente um agendamento de relatorio especifico",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "integer",
            description: "ID do agendamento de relatorio"
          }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "enviar_relatorio_agora",
      description: "Envia um relatorio imediatamente para os emails informados",
      parameters: {
        type: "object",
        properties: {
          emailsDestino: {
            type: "array",
            items: { type: "string" },
            description: "Lista de emails de destino"
          },
          nome: {
            type: "string",
            description: "Nome do relatorio"
          },
          assunto: {
            type: "string",
            description: "Assunto opcional do email"
          },
          periodo: {
            type: "object",
            description: "Periodo do relatorio"
          },
          filtros: {
            type: "object",
            description: "Filtros e secoes do relatorio"
          }
        },
        required: ["emailsDestino", "periodo", "filtros"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "atualizar_limites_sensor",
      description: "Atualiza limites ideais e maximos de um sensor",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "integer",
            description: "ID do sensor"
          },
          limiteTemperatura: {
            type: "number",
            description: "Novo limite de temperatura"
          },
          idealTemperatura: {
            type: "number",
            description: "Novo valor ideal de temperatura"
          },
          limiteVibracao: {
            type: "number",
            description: "Novo limite de vibracao"
          },
          idealVibracao: {
            type: "number",
            description: "Novo valor ideal de vibracao"
          },
          desvioMaximoTemp: {
            type: "number",
            description: "Novo desvio maximo de temperatura"
          },
          desvioMaximoVibra: {
            type: "number",
            description: "Novo desvio maximo de vibracao"
          }
        },
        required: ["id"]
      }
    }
  }
];

function normalizeLimit(value, fallback = 10) {
  return Math.min(Math.max(Number(value || fallback), 1), 20);
}

function mapUsuario(item) {
  return {
    id: item.id,
    nome: item.nome,
    email: item.email,
    role: item.role,
    ativo: item.ativo,
    especialidade: item.especialidade,
    telefone: item.telefone
  };
}

function mapSensor(item) {
  return {
    id: item.id,
    tipo: item.tipo,
    status: item.status,
    limiteTemperatura: item.limiteTemperatura,
    idealTemperatura: item.idealTemperatura,
    limiteVibracao: item.limiteVibracao,
    idealVibracao: item.idealVibracao,
    ultimaTemperatura: item.ultimaTemperatura,
    ultimaVibracao: item.ultimaVibracao,
    ultimaLeituraEm: item.ultimaLeituraEm,
    maquina: item.maquina
      ? {
          id: item.maquina.id,
          nome: item.maquina.nome,
          setor: item.maquina.setor,
          criticidade: item.maquina.criticidade,
          ativo: item.maquina.ativo
        }
      : null
  };
}

function mapAlerta(item) {
  return {
    id: item.id,
    tipo: item.tipo,
    status: item.status,
    mensagem: item.mensagem,
    criadoEm: item.criadoEm,
    encerradoEm: item.encerradoEm,
    sensor: item.sensor
      ? {
          id: item.sensor.id,
          tipo: item.sensor.tipo,
          status: item.sensor.status
        }
      : null,
    maquina: item.maquina
      ? {
          id: item.maquina.id,
          nome: item.maquina.nome,
          setor: item.maquina.setor,
          criticidade: item.maquina.criticidade,
          ativo: item.maquina.ativo,
          integridade: item.maquina.integridade
        }
      : null,
    tecnico: item.tecnico
      ? {
          id: item.tecnico.id,
          nome: item.tecnico.nome,
          email: item.tecnico.email,
          role: item.tecnico.role,
          ativo: item.tecnico.ativo
        }
      : null
  };
}

function mapMaquina(item) {
  return {
    id: item.id,
    nome: item.nome,
    setor: item.setor,
    tipo: item.tipo,
    criticidade: item.criticidade,
    ativo: item.ativo,
    integridade: item.integridade,
    scoreEstabilidade: item.scoreEstabilidade,
    previsaoManutencao: item.previsaoManutencao,
    janelaManuInicio: item.janelaManuInicio,
    janelaManuFim: item.janelaManuFim
  };
}

function mapManutencao(item) {
  return {
    id: item.id,
    alertaId: item.alertaId,
    usuarioId: item.usuarioId,
    observacao: item.observacao,
    status: item.status,
    criadoEm: item.criadoEm,
    alerta: item.alerta
      ? {
          id: item.alerta.id,
          tipo: item.alerta.tipo,
          status: item.alerta.status,
          mensagem: item.alerta.mensagem
        }
      : null,
    usuario: item.usuario
      ? {
          id: item.usuario.id,
          nome: item.usuario.nome,
          email: item.usuario.email,
          role: item.usuario.role,
          telefone: item.usuario.telefone,
          especialidade: item.usuario.especialidade
        }
      : null
  };
}

function mapAlertaEvento(item) {
  return {
    id: item.id,
    alertaId: item.alertaId,
    tipo: item.tipo,
    statusAnterior: item.statusAnterior,
    statusNovo: item.statusNovo,
    mensagem: item.mensagem,
    descricao: item.descricao,
    criadoEm: item.criadoEm,
    usuario: item.usuario
      ? {
          id: item.usuario.id,
          nome: item.usuario.nome,
          email: item.usuario.email,
          role: item.usuario.role
        }
      : null,
    manutencao: item.manutencao
      ? {
          id: item.manutencao.id,
          status: item.manutencao.status,
          criadoEm: item.manutencao.criadoEm
        }
      : null
  };
}

function mapRelatorioAgendamento(item) {
  return {
    id: item.id,
    nome: item.nome,
    status: item.status,
    frequencia: item.frequencia,
    hora: item.hora,
    minuto: item.minuto,
    diaSemana: item.diaSemana,
    diaMes: item.diaMes,
    assunto: item.assunto,
    tipoPeriodo: item.tipoPeriodo,
    periodo: item.periodo,
    filtros: item.filtros,
    secoes: item.secoes,
    proximoEnvioEm: item.proximoEnvioEm,
    ultimoEnvioEm: item.ultimoEnvioEm,
    ultimoSucessoEm: item.ultimoSucessoEm,
    ultimoErroEm: item.ultimoErroEm,
    descricaoAgendamento: item.descricaoAgendamento,
    criadoPor: item.criadoPor
      ? {
          id: item.criadoPor.id,
          nome: item.criadoPor.nome,
          email: item.criadoPor.email,
          role: item.criadoPor.role
        }
      : null,
    destinatarios: Array.isArray(item.destinatarios)
      ? item.destinatarios.map((destinatario) => ({
          id: destinatario.id,
          email: destinatario.email,
          nome: destinatario.nome,
          criadoEm: destinatario.criadoEm
        }))
      : []
  };
}

function mapRelatorioExecucao(item) {
  return {
    id: item.id,
    agendamentoId: item.agendamentoId,
    tipoExecucao: item.tipoExecucao,
    status: item.status,
    assunto: item.assunto,
    emailsDestino: item.emailsDestino,
    provider: item.provider,
    messageId: item.messageId,
    erro: item.erro,
    iniciadoEm: item.iniciadoEm,
    finalizadoEm: item.finalizadoEm
  };
}

const WRITE_TOOL_NAMES = new Set([
  "pausar_agendamento_relatorio",
  "deletar_agendamento_relatorio",
  "executar_agendamento_relatorio_agora",
  "enviar_relatorio_agora",
  "atualizar_limites_sensor"
]);

function isWriteTool(name) {
  return WRITE_TOOL_NAMES.has(name);
}

async function prepareWriteToolAction({ name, args, usuario }) {
  if (!usuario || usuario.role !== "ADMIN") {
    throw new AppError("Usuario sem permissao para usar tools administrativas.", 403);
  }

  if (name === "pausar_agendamento_relatorio") {
    const agendamento = await RelatorioAgendamentoService.findById({ usuario, id: args.id });

    return {
      name,
      args: { id: Number(args.id) },
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
    const agendamento = await RelatorioAgendamentoService.findById({ usuario, id: args.id });

    return {
      name,
      args: { id: Number(args.id) },
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
    const agendamento = await RelatorioAgendamentoService.findById({ usuario, id: args.id });

    return {
      name,
      args: { id: Number(args.id) },
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
    const emailsDestino = RelatorioExecucaoService.validateDestinatarios(args.emailsDestino);

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

  if (name === "atualizar_limites_sensor") {
    const sensor = await SensorService.findById(args.id);
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
        const value = Number(args[field]);

        if (!Number.isFinite(value)) {
          throw new AppError(`Valor invalido para ${field}.`, 400);
        }

        changedFields[field] = value;
      }
    }

    if (Object.keys(changedFields).length === 0) {
      throw new AppError("Informe ao menos um limite do sensor para atualizar.", 400);
    }

    return {
      name,
      args: {
        id: Number(args.id),
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
  if (!usuario || usuario.role !== "ADMIN") {
    throw new AppError("Usuario sem permissao para usar tools administrativas.", 403);
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

  if (action.name === "atualizar_limites_sensor") {
    const result = await SensorService.update(action.args.id, action.args.data);

    return {
      message: "Limites do sensor atualizados com sucesso.",
      sensor: mapSensor(result)
    };
  }

  throw new AppError(`Tool de escrita nao suportada: ${action.name}`, 400);
}

async function executeTool({ name, args, usuario }) {
  if (!usuario || usuario.role !== "ADMIN") {
    throw new AppError("Usuario sem permissao para usar tools administrativas.", 403);
  }

  if (isWriteTool(name)) {
    throw new AppError("Esta tool exige confirmacao antes da execucao.", 400);
  }

  if (name === "buscar_usuario_por_id") {
    const usuarioEncontrado = await UsuarioService.findById(args.id);
    return mapUsuario(usuarioEncontrado);
  }

  if (name === "buscar_usuario_por_nome") {
    const nome = String(args?.nome || "").trim();
    const limite = normalizeLimit(args?.limite);
    const somenteAtivos = typeof args?.somenteAtivos === "boolean" ? args.somenteAtivos : undefined;
    const role = typeof args?.role === "string" ? args.role : undefined;

    const result = await UsuarioService.findByNome({
      nome,
      limit: limite,
      somenteAtivos,
      role
    });

    return {
      total: result.total,
      filtroNome: nome,
      filtroRole: role ? String(role).toUpperCase() : null,
      usuarios: result.dados.map(mapUsuario)
    };
  }

  if (name === "listar_tecnicos") {
    const somenteAtivos = Boolean(args?.somenteAtivos);
    const limite = normalizeLimit(args?.limite);
    const nome = typeof args?.nome === "string" ? args.nome.trim() : "";

    if (nome) {
      const result = await UsuarioService.findTecnicosByNome({
        nome,
        limit: limite,
        somenteAtivos
      });

      return {
        total: result.total,
        filtroNome: nome,
        tecnicos: result.dados.map((item) => ({
          id: item.id,
          nome: item.nome,
          ativo: item.ativo,
          especialidade: item.especialidade,
          telefone: item.telefone,
          alertaEmAndamento: item.alertaEmAndamento
        }))
      };
    }

    const result = await UsuarioService.listAllTecnicos({ page: 1, limit: limite });

    return {
      total: result.total,
      tecnicos: result.dados
        .filter((item) => (somenteAtivos ? item.ativo : true))
        .map((item) => ({
          id: item.id,
          nome: item.nome,
          ativo: item.ativo,
          especialidade: item.especialidade,
          telefone: item.telefone
        }))
    };
  }

  if (name === "buscar_tecnico_por_nome") {
    const nome = String(args?.nome || "").trim();
    const somenteAtivos = typeof args?.somenteAtivos === "boolean" ? args.somenteAtivos : undefined;
    const limite = normalizeLimit(args?.limite);

    const result = await UsuarioService.findTecnicosByNome({
      nome,
      limit: limite,
      somenteAtivos
    });

    return {
      total: result.total,
      filtroNome: nome,
      tecnicos: result.dados.map((item) => ({
        id: item.id,
        nome: item.nome,
        ativo: item.ativo,
        especialidade: item.especialidade,
        telefone: item.telefone,
        alertaEmAndamento: item.alertaEmAndamento
      }))
    };
  }

  if (name === "buscar_tecnico_por_id") {
    const tecnico = await UsuarioService.findTecnicoById(args.id);

    return {
      id: tecnico.id,
      nome: tecnico.nome,
      ativo: tecnico.ativo,
      especialidade: tecnico.especialidade,
      telefone: tecnico.telefone,
      alertaEmAndamento: tecnico.alertaEmAndamento
    };
  }

  if (name === "buscar_sensor_por_id") {
    const sensor = await SensorService.findById(args.id);
    return mapSensor(sensor);
  }

  if (name === "buscar_sensor_por_tipo") {
    const tipo = String(args?.tipo || "").trim();
    const limite = normalizeLimit(args?.limite);
    const maquinaId = args?.maquinaId;
    const status = typeof args?.status === "string" ? String(args.status).trim().toUpperCase() : undefined;

    const result = await SensorService.findByTipo({
      tipo,
      maquinaId,
      status,
      limit: limite
    });

    return {
      total: result.total,
      filtroTipo: tipo,
      sensores: result.dados.map(mapSensor)
    };
  }

  if (name === "buscar_alerta_por_id") {
    const alerta = await AlertaService.findById(args.id);
    return {
      ...mapAlerta(alerta),
      eventos: Array.isArray(alerta.eventos)
        ? alerta.eventos.slice(0, 10).map((evento) => ({
            id: evento.id,
            tipo: evento.tipo,
            statusAnterior: evento.statusAnterior,
            statusNovo: evento.statusNovo,
            descricao: evento.descricao,
            criadoEm: evento.criadoEm,
            usuario: evento.usuario
              ? {
                  id: evento.usuario.id,
                  nome: evento.usuario.nome,
                  email: evento.usuario.email,
                  role: evento.usuario.role
                }
              : null
          }))
        : [],
      manutencoes: Array.isArray(alerta.manutencoes)
        ? alerta.manutencoes.slice(0, 10).map((item) => ({
            id: item.id,
            usuarioId: item.usuarioId,
            status: item.status,
            observacao: item.observacao,
            criadoEm: item.criadoEm
          }))
        : []
    };
  }

  if (name === "buscar_alertas_ativos") {
    const limite = normalizeLimit(args?.limite);
    const result = await AlertaService.findAtivos({ limit: limite });

    return {
      total: result.total,
      alertas: result.dados.map(mapAlerta)
    };
  }

  if (name === "buscar_eventos_por_alerta") {
    const limite = normalizeLimit(args?.limite);
    const dados = await AlertaService.findEventosByAlertaId(args.alertaId);

    return {
      total: Math.min(dados.length, limite),
      alertaId: Number(args.alertaId),
      eventos: dados.slice(0, limite).map(mapAlertaEvento)
    };
  }

  if (name === "buscar_alertas_por_maquina") {
    const limite = normalizeLimit(args?.limite);
    const somenteAtivos = Boolean(args?.somenteAtivos);
    const result = await AlertaService.findByMaquinaId(args.maquinaId, {
      limit: limite,
      somenteAtivos
    });

    return {
      total: result.total,
      maquinaId: Number(args.maquinaId),
      alertas: result.dados.map(mapAlerta)
    };
  }

  if (name === "buscar_alertas_por_tecnico") {
    const limite = normalizeLimit(args?.limite);
    const somenteAtivos = Boolean(args?.somenteAtivos);
    const result = await UsuarioService.findAlertasByTecnicoId(args.tecnicoId, {
      page: 1,
      limit: limite
    });

    const dados = somenteAtivos
      ? result.dados.filter((item) => item.status === "ATIVO")
      : result.dados;

    return {
      total: dados.length,
      tecnicoId: Number(args.tecnicoId),
      alertas: dados.map(mapAlerta)
    };
  }

  if (name === "buscar_manutencao_por_id") {
    const manutencao = await ManutecaoService.findById(args.id);
    return mapManutencao(manutencao);
  }

  if (name === "buscar_manutencoes_por_alerta") {
    const limite = normalizeLimit(args?.limite);
    const dados = await ManutecaoService.findByAlertaId(args.alertaId);

    return {
      total: Math.min(dados.length, limite),
      alertaId: Number(args.alertaId),
      manutencoes: dados.slice(0, limite).map(mapManutencao)
    };
  }

  if (name === "buscar_maquina_por_nome") {
    const nome = String(args?.nome || "").trim();
    const somenteAtivas = typeof args?.somenteAtivas === "boolean" ? args.somenteAtivas : undefined;
    const limite = normalizeLimit(args?.limite);

    const result = await MaquinaService.findByNome({
      nome,
      limit: limite,
      somenteAtivas
    });

    return {
      total: result.total,
      filtroNome: nome,
      maquinas: result.dados.map(mapMaquina)
    };
  }

  if (name === "buscar_maquina_por_id") {
    const maquina = await MaquinaService.findById(args.id);

    return mapMaquina(maquina);
  }

  if (name === "buscar_maquinas_criticas") {
    const limite = normalizeLimit(args?.limite);
    const dados = await MaquinaService.listCriticas({ limit: limite });

    return {
      total: dados.length,
      maquinas: dados.map(mapMaquina)
    };
  }

  if (name === "listar_sensores_por_maquina") {
    const limite = normalizeLimit(args?.limite);
    const status = typeof args?.status === "string" ? String(args.status).trim().toUpperCase() : undefined;
    const result = await SensorService.findByMaquinaId({
      maquinaId: args.maquinaId,
      status,
      limit: limite
    });

    return {
      total: result.total,
      maquinaId: Number(args.maquinaId),
      sensores: result.dados.map(mapSensor)
    };
  }

  if (name === "buscar_sensores_offline") {
    const limite = normalizeLimit(args?.limite);
    const result = await SensorService.listOfflineRecentes({ limit: limite });

    return {
      total: result.total,
      sensores: result.dados.map(mapSensor)
    };
  }

  if (name === "buscar_maquina_detalhada_por_id") {
    const maquina = await MaquinaService.findDetalhadaById(args.id);

    return {
      ...mapMaquina(maquina),
      sensores: Array.isArray(maquina.sensores) ? maquina.sensores.map((sensor) => ({
        ...mapSensor(sensor),
        maquina: null
      })) : [],
      alertasAtivos: Array.isArray(maquina.alertas) ? maquina.alertas.map(mapAlerta) : []
    };
  }

  if (name === "buscar_maquinas_em_alerta") {
    const limite = normalizeLimit(args?.limite);
    const dados = await MaquinaService.findComAlertaAtivo({ limit: limite });

    return {
      total: dados.length,
      maquinas: dados.map(mapMaquina)
    };
  }

  if (name === "listar_agendamentos_relatorio") {
    const dados = await RelatorioAgendamentoService.list({ usuario });

    return {
      total: dados.length,
      agendamentos: dados.map(mapRelatorioAgendamento)
    };
  }

  if (name === "buscar_agendamento_relatorio_por_id") {
    const agendamento = await RelatorioAgendamentoService.findById({
      usuario,
      id: args.id
    });

    return mapRelatorioAgendamento(agendamento);
  }

  if (name === "listar_execucoes_relatorio") {
    const dados = await RelatorioExecucaoService.listExecutions({
      id: args.agendamentoId,
      usuario
    });

    return {
      total: dados.length,
      agendamentoId: Number(args.agendamentoId),
      execucoes: dados.map(mapRelatorioExecucao)
    };
  }

  throw new AppError(`Tool nao suportada: ${name}`, 400);
}

module.exports = {
  tools,
  executeTool,
  isWriteTool,
  prepareWriteToolAction,
  executeWriteTool
};
