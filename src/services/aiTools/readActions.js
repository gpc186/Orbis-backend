const AppError = require("../../utils/appErrorUtils");
const { normalizeLimit } = require("../../utils/requestParsers");
const UsuarioService = require("../usuarioService");
const MaquinaService = require("../maquinaService");
const SensorService = require("../sensorService");
const AlertaService = require("../alertaService");
const ManutecaoService = require("../manutencaoService");
const DashboardService = require("../dashboardService");
const RelatorioAgendamentoService = require("../relatorioAgendamentoService");
const RelatorioExecucaoService = require("../relatorioExecucaoService");
const {
  mapUsuario,
  mapSensor,
  mapAlerta,
  mapMaquina,
  mapManutencao,
  mapAlertaEvento,
  mapRelatorioAgendamento,
  mapRelatorioExecucao
} = require("./mappers");
const {
  assertReadToolPermission,
  isWriteTool
} = require("./guards");

async function executeTool({ name, args, usuario }) {
  assertReadToolPermission(usuario);

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
  executeTool
};
