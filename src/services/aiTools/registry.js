const UsuarioService = require("../usuarioService");
const MaquinaService = require("../maquinaService");
const SensorService = require("../sensorService");
const AlertaService = require("../alertaService");
const ManutecaoService = require("../manutencaoService");
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

async function executeTool({ name, args, usuario }) {
  if (!usuario || usuario.role !== "ADMIN") {
    throw new AppError("Usuario sem permissao para usar tools administrativas.", 403);
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

  if (name === "buscar_sensores_offline") {
    const limite = normalizeLimit(args?.limite);
    const result = await SensorService.listOfflineRecentes({ limit: limite });

    return {
      total: result.total,
      sensores: result.dados.map(mapSensor)
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

  throw new AppError(`Tool nao suportada: ${name}`, 400);
}

module.exports = {
  tools,
  executeTool
};
