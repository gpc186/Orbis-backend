const UsuarioService = require("../usuarioService");
const MaquinaService = require("../maquinaService");
const SensorService = require("../sensorService");
const AlertaService = require("../alertaService");
const ManutecaoService = require("../manutencaoService");
const DashboardService = require("../dashboardService");
const RelatorioAgendamentoService = require("../relatorioAgendamentoService");
const RelatorioExecucaoService = require("../relatorioExecucaoService");
const {
  validatePreviewPayload,
  validateSchedulePayload
} = require("../../utils/reportValidation");
const AppError = require("../../utils/appErrorUtils");
const { isWriteTool: isWriteToolHandler } = require("./guards");
const {
  prepareWriteToolAction: prepareWriteToolActionHandler,
  executeWriteTool: executeWriteToolHandler
} = require("./writeActions");
const { executeTool: executeToolHandler } = require("./readActions");

const tools = [
  {
    type: "function",
    function: {
      name: "buscar_dashboard_resumo",
      description: "Busca o resumo operacional atual do dashboard com maquinas, alertas, sensores e tecnicos",
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
      name: "buscar_dashboard_top_alertas",
      description: "Lista os alertas ativos mais relevantes do dashboard",
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
      name: "buscar_dashboard_maquinas_criticas",
      description: "Lista as maquinas mais criticas do dashboard pelo menor indice de integridade",
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
      name: "buscar_dashboard_sensores_offline",
      description: "Lista sensores offline recentes do dashboard",
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
      name: "buscar_dashboard_destaques",
      description: "Lista os destaques operacionais resumidos do dashboard",
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
      name: "buscar_contexto_operacional_dashboard",
      description: "Busca o contexto operacional agregado do dashboard com resumo, top alertas, maquinas criticas, sensores offline e destaques",
      parameters: {
        type: "object",
        properties: {
          limite: {
            type: "integer",
            description: "Quantidade maxima de itens por colecao"
          }
        },
        required: []
      }
    }
  },
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
      name: "criar_agendamento_relatorio",
      description: "Cria um novo agendamento de relatorio",
      parameters: {
        type: "object",
        properties: {
          nome: {
            type: "string",
            description: "Nome do relatório"
          },
          emailsDestino: {
            type: "array",
            items: { type: "string" },
            description: "Lista de e-mails destinatários"
          },
          assunto: {
            type: "string",
            description: "Assunto opcional do e-mail"
          },
          periodo: {
            type: "object",
            description: "Período do relatório"
          },
          filtros: {
            type: "object",
            description: "Filtros e seções do relatório"
          },
          agendamento: {
            type: "object",
            description: "Configuração de frequência e horário"
          }
        },
        required: ["nome", "emailsDestino", "periodo", "filtros", "agendamento"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "atualizar_agendamento_relatorio",
      description: "Atualiza um agendamento de relatorio existente",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "integer",
            description: "ID do agendamento de relatório"
          },
          email: {
            type: "string",
            description: "E-mail destinatário para localizar o agendamento quando o ID não for informado"
          },
          nome: {
            type: "string",
            description: "Nome do relatório"
          },
          emailsDestino: {
            type: "array",
            items: { type: "string" },
            description: "Lista de e-mails destinatários"
          },
          assunto: {
            type: "string",
            description: "Assunto opcional do e-mail"
          },
          periodo: {
            type: "object",
            description: "Período do relatório"
          },
          filtros: {
            type: "object",
            description: "Filtros e seções do relatório"
          },
          agendamento: {
            type: "object",
            description: "Configuração de frequência e horário"
          }
        },
        required: ["nome", "emailsDestino", "periodo", "filtros", "agendamento"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "reativar_agendamento_relatorio",
      description: "Reativa um agendamento de relatorio pausado",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "integer",
            description: "ID do agendamento de relatório"
          },
          email: {
            type: "string",
            description: "E-mail destinatário do agendamento para localizar o registro quando o ID não for informado"
          }
        },
        required: []
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
          },
          email: {
            type: "string",
            description: "E-mail destinatario do agendamento para localizar o registro quando o ID nao for informado"
          }
        },
        required: []
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
          },
          email: {
            type: "string",
            description: "E-mail destinatario do agendamento para localizar o registro quando o ID nao for informado"
          }
        },
        required: []
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
          },
          email: {
            type: "string",
            description: "E-mail destinatario do agendamento para localizar o registro quando o ID nao for informado"
          }
        },
        required: []
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
      name: "criar_manutencao_por_alerta",
      description: "Cria uma manutenção para um alerta específico",
      parameters: {
        type: "object",
        properties: {
          alertaId: {
            type: "integer",
            description: "ID do alerta"
          },
          observacao: {
            type: "string",
            description: "Observação da manutenção"
          }
        },
        required: ["alertaId", "observacao"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "atualizar_status_manutencao",
      description: "Atualiza o status e a observação de uma manutenção em andamento",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "integer",
            description: "ID da manutenção"
          },
          status: {
            type: "string",
            description: "Novo status da manutenção"
          },
          observacao: {
            type: "string",
            description: "Nova observação da manutenção"
          }
        },
        required: ["id", "status"]
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
          tipo: {
            type: "string",
            description: "Tipo do sensor para localizar o registro quando o ID nao for informado"
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
        required: []
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
    sla: item.sla || null,
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

function mapDisambiguationAgendamento(item) {
  return {
    id: item.id,
    nome: item.nome,
    status: item.status,
    descricaoAgendamento: item.descricaoAgendamento,
    destinatarios: Array.isArray(item.destinatarios)
      ? item.destinatarios.map((destinatario) => destinatario.email)
      : []
  };
}

function mapDisambiguationSensor(item) {
  return {
    id: item.id,
    tipo: item.tipo,
    status: item.status,
    maquina: item.maquina
      ? {
          id: item.maquina.id,
          nome: item.maquina.nome,
          setor: item.maquina.setor
        }
      : null
  };
}

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
    throw new AppError("Informe o id ou o e-mail destinatário do agendamento.", 400);
  }

  const items = await RelatorioAgendamentoService.findByDestinatarioEmail({
    usuario,
    email,
    limit: 10
  });

  if (items.length === 0) {
    throw new AppError("Nenhum agendamento de relatório encontrado para o e-mail informado.", 404);
  }

  if (items.length > 1) {
    return buildDisambiguationResult({
      entity: "relatorio_agendamento",
      actionName,
      actionLabel,
      message: `Encontrei mais de um agendamento de relatório com o e-mail ${email}. Escolha qual deles você quer usar.`,
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
      message: `Encontrei mais de um sensor com o tipo ${tipo}. Escolha qual deles você quer usar.`,
      options: result.dados.map(mapDisambiguationSensor)
    });
  }

  return result.dados[0];
}

const WRITE_TOOL_NAMES = new Set([
  "criar_agendamento_relatorio",
  "atualizar_agendamento_relatorio",
  "reativar_agendamento_relatorio",
  "pausar_agendamento_relatorio",
  "deletar_agendamento_relatorio",
  "executar_agendamento_relatorio_agora",
  "enviar_relatorio_agora",
  "criar_manutencao_por_alerta",
  "atualizar_status_manutencao",
  "atualizar_limites_sensor"
]);

function isWriteTool(name) {
  return WRITE_TOOL_NAMES.has(name);
}

function assertWriteToolPermission({ name, usuario }) {
  if (!usuario) {
    throw new AppError("Usuário sem permissão para usar tools administrativas.", 403);
  }

  const reportWriteTools = new Set([
    "criar_agendamento_relatorio",
    "atualizar_agendamento_relatorio",
    "reativar_agendamento_relatorio",
    "pausar_agendamento_relatorio",
    "deletar_agendamento_relatorio",
    "executar_agendamento_relatorio_agora",
    "enviar_relatorio_agora",
    "atualizar_limites_sensor"
  ]);

  if (reportWriteTools.has(name) && usuario.role !== "ADMIN") {
    throw new AppError("Usuário sem permissão para usar tools administrativas.", 403);
  }

  if (name === "criar_manutencao_por_alerta") {
    if (usuario.role !== "ADMIN" && usuario.role !== "TECNICO") {
      throw new AppError("Usuário sem permissão para criar manutenção.", 403);
    }

    return;
  }

  if (name === "atualizar_status_manutencao") {
    if (usuario.role !== "TECNICO") {
      throw new AppError("Apenas o técnico responsável pode atualizar a manutenção.", 403);
    }
  }
}

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
    if (agendamento.frequencia !== normalized.agendamento.frequencia) alteracoes.push("frequência");
    if (agendamento.hora !== normalized.agendamento.hora || agendamento.minuto !== normalized.agendamento.minuto) {
      alteracoes.push("horário");
    }
    if (agendamento.diaSemana !== normalized.agendamento.diaSemana) alteracoes.push("diaSemana");
    if (agendamento.diaMes !== normalized.agendamento.diaMes) alteracoes.push("diaMes");
    if (JSON.stringify(agendamento.periodo) !== JSON.stringify(normalized.periodo)) alteracoes.push("período");
    if (JSON.stringify(agendamento.filtros) !== JSON.stringify(normalized.filtros)) alteracoes.push("filtros");
    if (JSON.stringify(agendamento.secoes) !== JSON.stringify(normalized.filtros.secoes)) alteracoes.push("seções");
    if (JSON.stringify((agendamento.destinatarios || []).map((item) => item.email)) !== JSON.stringify(normalized.emailsDestino)) {
      alteracoes.push("destinatários");
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

  if (name === "criar_manutencao_por_alerta") {
    const alerta = await AlertaService.findById(args.alertaId);
    const observacao = String(args.observacao || "").trim();

    if (observacao.length < 3) {
      throw new AppError("Observação não é válida.", 400);
    }

    if (alerta.status === "RESOLVIDO" || alerta.status === "CANCELADO") {
      throw new AppError("Não é possível criar uma manutenção para um alerta encerrado.", 400);
    }

    const manutencaoEmAndamento = Array.isArray(alerta.manutencoes)
      && alerta.manutencoes.some((manutencao) => manutencao.status === "EM_ANDAMENTO");

    if (manutencaoEmAndamento) {
      throw new AppError("Já existe uma manutenção em aberto para este alerta.", 400);
    }

    return {
      name,
      args: {
        alertaId: Number(args.alertaId),
        observacao
      },
      actionLabel: "Criar manutenção",
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
      throw new AppError("Status de manutenção inválido.", 400);
    }

    if (manutencao.usuarioId !== usuario.id) {
      throw new AppError("Você não pode atualizar a manutenção de outro técnico.", 403);
    }

    if (manutencao.status !== "EM_ANDAMENTO") {
      throw new AppError("Manutenção encerrada não pode mais ser alterada.", 409);
    }

    if (observacao !== undefined && observacao.length > 0 && observacao.length < 3) {
      throw new AppError("Observação não é válida.", 400);
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
      actionLabel: "Atualizar manutenção",
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
      message: "Manutenção criada com sucesso.",
      manutencao: mapManutencao(result)
    };
  }

  if (action.name === "atualizar_status_manutencao") {
    const result = await ManutecaoService.update(action.args.id, usuario.id, {
      dados: action.args.dados
    });

    return {
      message: "Manutenção atualizada com sucesso.",
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

async function executeTool({ name, args, usuario }) {
  if (!usuario || usuario.role !== "ADMIN") {
    throw new AppError("Usuario sem permissao para usar tools administrativas.", 403);
  }

  if (isWriteTool(name)) {
    throw new AppError("Esta tool exige confirmacao antes da execucao.", 400);
  }

  if (name === "buscar_dashboard_resumo") {
    return await DashboardService.resume();
  }

  if (name === "buscar_dashboard_top_alertas") {
    const limite = normalizeLimit(args?.limite);
    const dados = await DashboardService.getTopAlertas({ limit: limite });

    return {
      total: dados.length,
      alertas: dados.map(mapAlerta)
    };
  }

  if (name === "buscar_dashboard_maquinas_criticas") {
    const limite = normalizeLimit(args?.limite);
    const dados = await DashboardService.getMaquinasCriticas({ limit: limite });

    return {
      total: dados.length,
      maquinas: dados.map(mapMaquina)
    };
  }

  if (name === "buscar_dashboard_sensores_offline") {
    const limite = normalizeLimit(args?.limite);
    const dados = await DashboardService.getSensoresOffline({ limit: limite });

    return {
      total: dados.length,
      sensores: dados.map(mapSensor)
    };
  }

  if (name === "buscar_dashboard_destaques") {
    const dados = await DashboardService.getDestaques();

    return {
      total: dados.length,
      destaques: dados
    };
  }

  if (name === "buscar_contexto_operacional_dashboard") {
    const limite = normalizeLimit(args?.limite, 5);
    const dados = await DashboardService.getOperationalContext({ limit: limite });

    return {
      resumo: dados.resumo,
      topAlertas: dados.topAlertas.map(mapAlerta),
      maquinasCriticas: dados.maquinasCriticas.map(mapMaquina),
      sensoresOffline: dados.sensoresOffline.map(mapSensor),
      destaques: dados.destaques
    };
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
  executeTool: executeToolHandler,
  isWriteTool: isWriteToolHandler,
  prepareWriteToolAction: prepareWriteToolActionHandler,
  executeWriteTool: executeWriteToolHandler
};
