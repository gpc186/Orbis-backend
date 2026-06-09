const assert = require("node:assert/strict");
const test = require("node:test");

const UsuarioService = require("../../../../src/services/usuarioService");
const SensorService = require("../../../../src/services/sensorService");
const AlertaService = require("../../../../src/services/alertaService");
const MaquinaService = require("../../../../src/services/maquinaService");
const ManutecaoService = require("../../../../src/services/manutencaoService");
const DashboardService = require("../../../../src/services/dashboardService");
const RelatorioAgendamentoService = require("../../../../src/services/relatorioAgendamentoService");
const RelatorioExecucaoService = require("../../../../src/services/relatorioExecucaoService");
const AppError = require("../../../../src/utils/appErrorUtils");
const { executeTool, prepareWriteToolAction, executeWriteTool } = require("../../../../src/services/aiTools/registry");

const admin = { id: 1, role: "ADMIN" };
const visitante = { id: 3, role: "VISITANTE" };

test("executeTool consulta resumo do dashboard", async () => {
  const originalResume = DashboardService.resume;

  DashboardService.resume = async () => ({
    totalMaquinas: 12,
    maquinasEmAlerta: 3,
    maquinasFuncionando: 9,
    alertasAtivos: 5,
    alertasHoje: 2,
    tecnicosAtivos: 4,
    integridadeMedia: 87.4,
    sensoresOnline: 20,
    alertaSemAtendimento: 1,
    alertasAtendidosHoje: 1
  });

  try {
    const result = await executeTool({
      name: "buscar_dashboard_resumo",
      args: {},
      usuario: admin
    });

    assert.equal(result.totalMaquinas, 12);
    assert.equal(result.alertasAtivos, 5);
  } finally {
    DashboardService.resume = originalResume;
  }
});

test("executeTool consulta top alertas do dashboard", async () => {
  const originalGetTopAlertas = DashboardService.getTopAlertas;

  DashboardService.getTopAlertas = async () => ([
    {
      id: 8,
      tipo: "INSTABILIDADE",
      status: "ATIVO",
      mensagem: "Oscilacao detectada",
      criadoEm: "2026-05-20T12:00:00.000Z",
      encerradoEm: null,
      sensor: { id: 2, tipo: "Vibracao", status: "ONLINE" },
      maquina: { id: 5, nome: "Prensa 02", setor: "Usinagem", criticidade: "MEDIA", ativo: true, integridade: 72 },
      tecnico: null
    }
  ]);

  try {
    const result = await executeTool({
      name: "buscar_dashboard_top_alertas",
      args: { limite: 5 },
      usuario: admin
    });

    assert.equal(result.total, 1);
    assert.equal(result.alertas[0].id, 8);
  } finally {
    DashboardService.getTopAlertas = originalGetTopAlertas;
  }
});

test("executeTool consulta contexto operacional do dashboard", async () => {
  const originalGetOperationalContext = DashboardService.getOperationalContext;

  DashboardService.getOperationalContext = async () => ({
    resumo: {
      totalMaquinas: 12,
      maquinasEmAlerta: 3,
      maquinasFuncionando: 9,
      alertasAtivos: 5,
      alertasHoje: 2,
      tecnicosAtivos: 4,
      integridadeMedia: 87.4,
      sensoresOnline: 20,
      alertaSemAtendimento: 1,
      alertasAtendidosHoje: 1
    },
    topAlertas: [{
      id: 8,
      tipo: "INSTABILIDADE",
      status: "ATIVO",
      mensagem: "Oscilacao detectada",
      criadoEm: "2026-05-20T12:00:00.000Z",
      encerradoEm: null,
      sensor: { id: 2, tipo: "Vibracao", status: "ONLINE" },
      maquina: { id: 5, nome: "Prensa 02", setor: "Usinagem", criticidade: "MEDIA", ativo: true, integridade: 72 },
      tecnico: null
    }],
    maquinasCriticas: [{
      id: 7,
      nome: "Prensa 07",
      setor: "Corte",
      tipo: "Prensa",
      criticidade: "ALTA",
      ativo: true,
      integridade: 63,
      scoreEstabilidade: 59,
      previsaoManutencao: null,
      janelaManuInicio: null,
      janelaManuFim: null
    }],
    sensoresOffline: [{
      id: 12,
      tipo: "Temperatura",
      status: "OFFLINE",
      limiteTemperatura: 90,
      idealTemperatura: 60,
      limiteVibracao: 20,
      idealVibracao: 6,
      ultimaTemperatura: 58,
      ultimaVibracao: 5,
      ultimaLeituraEm: "2026-05-20T12:00:00.000Z",
      maquina: { id: 4, nome: "Prensa 01", setor: "Corte", criticidade: "ALTA", ativo: true }
    }],
    destaques: ["5 alertas ativos no momento."]
  });

  try {
    const result = await executeTool({
      name: "buscar_contexto_operacional_dashboard",
      args: { limite: 5 },
      usuario: admin
    });

    assert.equal(result.resumo.totalMaquinas, 12);
    assert.equal(result.topAlertas.length, 1);
    assert.equal(result.maquinasCriticas.length, 1);
    assert.equal(result.sensoresOffline.length, 1);
    assert.equal(result.destaques.length, 1);
  } finally {
    DashboardService.getOperationalContext = originalGetOperationalContext;
  }
});

test("executeTool bloqueia usuario nao ADMIN", async () => {
  await assert.rejects(
    () => executeTool({ name: "buscar_usuario_por_id", args: { id: 1 }, usuario: { id: 2, role: "TECNICO" } }),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 403);
      return true;
    }
  );
});

test("executeTool permite visitante em consulta administrativa", async () => {
  const originalResume = DashboardService.resume;

  DashboardService.resume = async () => ({
    totalMaquinas: 1,
    maquinasEmAlerta: 0
  });

  try {
    const result = await executeTool({
      name: "buscar_dashboard_resumo",
      args: {},
      usuario: visitante
    });

    assert.equal(result.totalMaquinas, 1);
  } finally {
    DashboardService.resume = originalResume;
  }
});

test("executeTool consulta usuario por nome", async () => {
  const originalFindByNome = UsuarioService.findByNome;

  UsuarioService.findByNome = async () => ({
    total: 1,
    dados: [{
      id: 10,
      nome: "Carlos Silva",
      email: "carlos@orbis.com",
      role: "TECNICO",
      ativo: true,
      especialidade: "Vibracao",
      telefone: "11999999999"
    }]
  });

  try {
    const result = await executeTool({
      name: "buscar_usuario_por_nome",
      args: { nome: "Carlos", somenteAtivos: true, role: "TECNICO" },
      usuario: admin
    });

    assert.equal(result.total, 1);
    assert.equal(result.usuarios[0].nome, "Carlos Silva");
    assert.equal(result.usuarios[0].role, "TECNICO");
  } finally {
    UsuarioService.findByNome = originalFindByNome;
  }
});

test("executeTool consulta sensor por tipo", async () => {
  const originalFindByTipo = SensorService.findByTipo;

  SensorService.findByTipo = async () => ({
    total: 1,
    dados: [{
      id: 3,
      tipo: "Vibracao",
      status: "ONLINE",
      limiteTemperatura: 80,
      idealTemperatura: 55,
      limiteVibracao: 20,
      idealVibracao: 8,
      ultimaTemperatura: 56,
      ultimaVibracao: 9,
      ultimaLeituraEm: "2026-05-20T12:00:00.000Z",
      maquina: { id: 4, nome: "Prensa 01", setor: "Corte", criticidade: "ALTA", ativo: true }
    }]
  });

  try {
    const result = await executeTool({
      name: "buscar_sensor_por_tipo",
      args: { tipo: "Vibr", status: "ONLINE" },
      usuario: admin
    });

    assert.equal(result.total, 1);
    assert.equal(result.sensores[0].tipo, "Vibracao");
    assert.equal(result.sensores[0].maquina.nome, "Prensa 01");
  } finally {
    SensorService.findByTipo = originalFindByTipo;
  }
});

test("executeTool consulta alertas por maquina respeitando filtro de ativos", async () => {
  const originalFindByMaquinaId = AlertaService.findByMaquinaId;

  AlertaService.findByMaquinaId = async () => ({
    total: 1,
    dados: [{
      id: 8,
      tipo: "INSTABILIDADE",
      status: "ATIVO",
      mensagem: "Oscilacao detectada",
      criadoEm: "2026-05-20T12:00:00.000Z",
      encerradoEm: null,
      sensor: { id: 2, tipo: "Vibracao", status: "ONLINE" },
      maquina: { id: 5, nome: "Prensa 02", setor: "Usinagem", criticidade: "MEDIA", ativo: true, integridade: 72 },
      tecnico: null
    }]
  });

  try {
    const result = await executeTool({
      name: "buscar_alertas_por_maquina",
      args: { maquinaId: 5, somenteAtivos: true },
      usuario: admin
    });

    assert.equal(result.total, 1);
    assert.equal(result.alertas[0].status, "ATIVO");
    assert.equal(result.alertas[0].maquina.id, 5);
  } finally {
    AlertaService.findByMaquinaId = originalFindByMaquinaId;
  }
});

test("executeTool consulta manutencoes por alerta com limite", async () => {
  const originalFindByAlertaId = ManutecaoService.findByAlertaId;

  ManutecaoService.findByAlertaId = async () => ([
    {
      id: 1,
      alertaId: 9,
      usuarioId: 2,
      observacao: "Verificando",
      status: "EM_ANDAMENTO",
      criadoEm: "2026-05-20T12:00:00.000Z",
      alerta: { id: 9, tipo: "INSTABILIDADE", status: "ATIVO", mensagem: "Oscilacao" },
      usuario: { id: 2, nome: "Carlos", email: "carlos@orbis.com", role: "TECNICO", telefone: "11999999999", especialidade: "Vibracao" }
    },
    {
      id: 2,
      alertaId: 9,
      usuarioId: 3,
      observacao: "Historico",
      status: "RESOLVIDO",
      criadoEm: "2026-05-19T12:00:00.000Z",
      alerta: { id: 9, tipo: "INSTABILIDADE", status: "ATIVO", mensagem: "Oscilacao" },
      usuario: { id: 3, nome: "Marina", email: "marina@orbis.com", role: "TECNICO", telefone: "11888888888", especialidade: "Temperatura" }
    }
  ]);

  try {
    const result = await executeTool({
      name: "buscar_manutencoes_por_alerta",
      args: { alertaId: 9, limite: 1 },
      usuario: admin
    });

    assert.equal(result.total, 1);
    assert.equal(result.manutencoes.length, 1);
    assert.equal(result.manutencoes[0].id, 1);
  } finally {
    ManutecaoService.findByAlertaId = originalFindByAlertaId;
  }
});

test("executeTool consulta maquinas em alerta sem duplicar contrato", async () => {
  const originalFindComAlertaAtivo = MaquinaService.findComAlertaAtivo;

  MaquinaService.findComAlertaAtivo = async () => ([
    {
      id: 7,
      nome: "Prensa 07",
      setor: "Corte",
      tipo: "Prensa",
      criticidade: "ALTA",
      ativo: true,
      integridade: 63,
      scoreEstabilidade: 59,
      previsaoManutencao: null,
      janelaManuInicio: null,
      janelaManuFim: null
    }
  ]);

  try {
    const result = await executeTool({
      name: "buscar_maquinas_em_alerta",
      args: { limite: 5 },
      usuario: admin
    });

    assert.equal(result.total, 1);
    assert.equal(result.maquinas[0].nome, "Prensa 07");
  } finally {
    MaquinaService.findComAlertaAtivo = originalFindComAlertaAtivo;
  }
});

test("executeTool consulta eventos por alerta com limite", async () => {
  const originalFindEventosByAlertaId = AlertaService.findEventosByAlertaId;

  AlertaService.findEventosByAlertaId = async () => ([
    {
      id: 11,
      alertaId: 8,
      tipo: "ATUALIZADO",
      statusAnterior: "ATIVO",
      statusNovo: "ATIVO",
      mensagem: "Ocorrencia repetida",
      descricao: "Limite ultrapassado novamente",
      criadoEm: "2026-05-20T12:00:00.000Z",
      usuario: { id: 2, nome: "Carlos", email: "carlos@orbis.com", role: "TECNICO" },
      manutencao: null
    },
    {
      id: 10,
      alertaId: 8,
      tipo: "CRIADO",
      statusAnterior: null,
      statusNovo: "ATIVO",
      mensagem: "Novo alerta",
      descricao: "Alerta criado automaticamente",
      criadoEm: "2026-05-20T11:00:00.000Z",
      usuario: null,
      manutencao: null
    }
  ]);

  try {
    const result = await executeTool({
      name: "buscar_eventos_por_alerta",
      args: { alertaId: 8, limite: 1 },
      usuario: admin
    });

    assert.equal(result.total, 1);
    assert.equal(result.alertaId, 8);
    assert.equal(result.eventos.length, 1);
    assert.equal(result.eventos[0].id, 11);
  } finally {
    AlertaService.findEventosByAlertaId = originalFindEventosByAlertaId;
  }
});

test("executeTool lista sensores por maquina", async () => {
  const originalFindByMaquinaId = SensorService.findByMaquinaId;

  SensorService.findByMaquinaId = async () => ({
    total: 1,
    dados: [{
      id: 12,
      tipo: "Temperatura",
      status: "ONLINE",
      limiteTemperatura: 90,
      idealTemperatura: 60,
      limiteVibracao: 20,
      idealVibracao: 6,
      ultimaTemperatura: 58,
      ultimaVibracao: 5,
      ultimaLeituraEm: "2026-05-20T12:00:00.000Z",
      maquina: { id: 4, nome: "Prensa 01", setor: "Corte", criticidade: "ALTA", ativo: true }
    }]
  });

  try {
    const result = await executeTool({
      name: "listar_sensores_por_maquina",
      args: { maquinaId: 4, status: "ONLINE", limite: 5 },
      usuario: admin
    });

    assert.equal(result.total, 1);
    assert.equal(result.maquinaId, 4);
    assert.equal(result.sensores[0].tipo, "Temperatura");
  } finally {
    SensorService.findByMaquinaId = originalFindByMaquinaId;
  }
});

test("executeTool consulta maquina detalhada por id", async () => {
  const originalFindDetalhadaById = MaquinaService.findDetalhadaById;

  MaquinaService.findDetalhadaById = async () => ({
    id: 7,
    nome: "Prensa 07",
    setor: "Corte",
    tipo: "Prensa",
    criticidade: "ALTA",
    ativo: true,
    integridade: 63,
    scoreEstabilidade: 59,
    previsaoManutencao: null,
    janelaManuInicio: null,
    janelaManuFim: null,
    sensores: [{
      id: 12,
      tipo: "Temperatura",
      status: "ONLINE",
      limiteTemperatura: 90,
      idealTemperatura: 60,
      limiteVibracao: 20,
      idealVibracao: 6,
      ultimaTemperatura: 58,
      ultimaVibracao: 5,
      ultimaLeituraEm: "2026-05-20T12:00:00.000Z"
    }],
    alertas: [{
      id: 8,
      tipo: "INSTABILIDADE",
      status: "ATIVO",
      mensagem: "Oscilacao detectada",
      criadoEm: "2026-05-20T12:00:00.000Z",
      encerradoEm: null,
      sensor: { id: 12, tipo: "Temperatura", status: "ONLINE" },
      maquina: { id: 7, nome: "Prensa 07", setor: "Corte", criticidade: "ALTA", ativo: true, integridade: 63 },
      tecnico: null
    }]
  });

  try {
    const result = await executeTool({
      name: "buscar_maquina_detalhada_por_id",
      args: { id: 7 },
      usuario: admin
    });

    assert.equal(result.id, 7);
    assert.equal(result.sensores.length, 1);
    assert.equal(result.alertasAtivos.length, 1);
  } finally {
    MaquinaService.findDetalhadaById = originalFindDetalhadaById;
  }
});

test("executeTool lista agendamentos de relatorio", async () => {
  const originalList = RelatorioAgendamentoService.list;

  RelatorioAgendamentoService.list = async () => ([
    {
      id: 3,
      nome: "Relatorio Semanal",
      status: "ATIVO",
      frequencia: "SEMANAL",
      hora: 8,
      minuto: 0,
      diaSemana: 1,
      diaMes: null,
      assunto: "Relatorio Orbis",
      tipoPeriodo: "RELATIVE_DAYS",
      periodo: { tipo: "RELATIVE_DAYS", valor: 7 },
      filtros: { secoes: ["resumo"] },
      secoes: ["resumo"],
      proximoEnvioEm: "2026-05-26 08:00",
      ultimoEnvioEm: null,
      ultimoSucessoEm: null,
      ultimoErroEm: null,
      descricaoAgendamento: "Toda segunda as 08:00",
      criadoPor: { id: 1, nome: "Admin", email: "admin@orbis.com", role: "ADMIN" },
      destinatarios: [{ id: 1, email: "gestao@orbis.com", nome: null, criadoEm: "2026-05-20T12:00:00.000Z" }]
    }
  ]);

  try {
    const result = await executeTool({
      name: "listar_agendamentos_relatorio",
      args: {},
      usuario: admin
    });

    assert.equal(result.total, 1);
    assert.equal(result.agendamentos[0].id, 3);
  } finally {
    RelatorioAgendamentoService.list = originalList;
  }
});

test("executeTool consulta agendamento de relatorio por id", async () => {
  const originalFindById = RelatorioAgendamentoService.findById;

  RelatorioAgendamentoService.findById = async () => ({
    id: 3,
    nome: "Relatorio Semanal",
    status: "ATIVO",
    frequencia: "SEMANAL",
    hora: 8,
    minuto: 0,
    diaSemana: 1,
    diaMes: null,
    assunto: "Relatorio Orbis",
    tipoPeriodo: "RELATIVE_DAYS",
    periodo: { tipo: "RELATIVE_DAYS", valor: 7 },
    filtros: { secoes: ["resumo"] },
    secoes: ["resumo"],
    proximoEnvioEm: "2026-05-26 08:00",
    ultimoEnvioEm: null,
    ultimoSucessoEm: null,
    ultimoErroEm: null,
    descricaoAgendamento: "Toda segunda as 08:00",
    criadoPor: { id: 1, nome: "Admin", email: "admin@orbis.com", role: "ADMIN" },
    destinatarios: [{ id: 1, email: "gestao@orbis.com", nome: null, criadoEm: "2026-05-20T12:00:00.000Z" }]
  });

  try {
    const result = await executeTool({
      name: "buscar_agendamento_relatorio_por_id",
      args: { id: 3 },
      usuario: admin
    });

    assert.equal(result.id, 3);
    assert.equal(result.destinatarios.length, 1);
  } finally {
    RelatorioAgendamentoService.findById = originalFindById;
  }
});

test("executeTool lista execucoes de relatorio", async () => {
  const originalListExecutions = RelatorioExecucaoService.listExecutions;

  RelatorioExecucaoService.listExecutions = async () => ([
    {
      id: 5,
      agendamentoId: 3,
      tipoExecucao: "AGENDADO",
      status: "ENVIADO",
      assunto: "Relatorio Orbis",
      emailsDestino: ["gestao@orbis.com"],
      provider: "resend",
      messageId: "abc-123",
      erro: null,
      iniciadoEm: "2026-05-20 08:00",
      finalizadoEm: "2026-05-20 08:01"
    }
  ]);

  try {
    const result = await executeTool({
      name: "listar_execucoes_relatorio",
      args: { agendamentoId: 3 },
      usuario: admin
    });

    assert.equal(result.total, 1);
    assert.equal(result.agendamentoId, 3);
    assert.equal(result.execucoes[0].status, "ENVIADO");
  } finally {
    RelatorioExecucaoService.listExecutions = originalListExecutions;
  }
});

test("prepareWriteToolAction resolve agendamento por e-mail com resultado único", async () => {
  const originalFindByDestinatarioEmail = RelatorioAgendamentoService.findByDestinatarioEmail;

  RelatorioAgendamentoService.findByDestinatarioEmail = async () => ([
    {
      id: 9,
      nome: "Relatório Semanal Operacional",
      status: "ATIVO",
      descricaoAgendamento: "Toda segunda às 08:00",
      proximoEnvioEm: "2026-05-26 08:00",
      destinatarios: [
        { id: 1, email: "gestao@orbis.com" }
      ]
    }
  ]);

  try {
    const result = await prepareWriteToolAction({
      name: "pausar_agendamento_relatorio",
      args: { email: "gestao@orbis.com" },
      usuario: admin
    });

    assert.equal(result.name, "pausar_agendamento_relatorio");
    assert.equal(result.args.id, 9);
    assert.equal(result.summary.nome, "Relatório Semanal Operacional");
  } finally {
    RelatorioAgendamentoService.findByDestinatarioEmail = originalFindByDestinatarioEmail;
  }
});

test("prepareWriteToolAction retorna desambiguação de agendamento por e-mail", async () => {
  const originalFindByDestinatarioEmail = RelatorioAgendamentoService.findByDestinatarioEmail;

  RelatorioAgendamentoService.findByDestinatarioEmail = async () => ([
    {
      id: 9,
      nome: "Relatório Semanal Operacional",
      status: "ATIVO",
      descricaoAgendamento: "Toda segunda às 08:00",
      destinatarios: [{ id: 1, email: "gestao@orbis.com" }]
    },
    {
      id: 12,
      nome: "Relatório Diretoria",
      status: "PAUSADO",
      descricaoAgendamento: "Todo dia 01 às 09:30",
      destinatarios: [{ id: 2, email: "gestao@orbis.com" }]
    }
  ]);

  try {
    const result = await prepareWriteToolAction({
      name: "deletar_agendamento_relatorio",
      args: { email: "gestao@orbis.com" },
      usuario: admin
    });

    assert.equal(result.kind, "disambiguation");
    assert.equal(result.entity, "relatorio_agendamento");
    assert.equal(result.options.length, 2);
    assert.equal(result.options[0].id, 9);
  } finally {
    RelatorioAgendamentoService.findByDestinatarioEmail = originalFindByDestinatarioEmail;
  }
});

test("prepareWriteToolAction resolve sensor por tipo com resultado único", async () => {
  const originalFindByTipo = SensorService.findByTipo;

  SensorService.findByTipo = async () => ({
    total: 1,
    dados: [
      {
        id: 14,
        tipo: "Temperatura",
        status: "ONLINE",
        maquinaId: 4,
        maquina: {
          id: 4,
          nome: "Prensa 02",
          setor: "Usinagem"
        },
        limiteTemperatura: 90,
        idealTemperatura: 60,
        limiteVibracao: 20,
        idealVibracao: 6,
        desvioMaximoTemp: 8,
        desvioMaximoVibra: 4
      }
    ]
  });

  try {
    const result = await prepareWriteToolAction({
      name: "atualizar_limites_sensor",
      args: { tipo: "Temperatura", limiteTemperatura: 95 },
      usuario: admin
    });

    assert.equal(result.name, "atualizar_limites_sensor");
    assert.equal(result.args.id, 14);
    assert.equal(result.summary.tipo, "Temperatura");
  } finally {
    SensorService.findByTipo = originalFindByTipo;
  }
});

test("prepareWriteToolAction retorna desambiguação de sensor por tipo", async () => {
  const originalFindByTipo = SensorService.findByTipo;

  SensorService.findByTipo = async () => ({
    total: 2,
    dados: [
      {
        id: 14,
        tipo: "Temperatura",
        status: "ONLINE",
        maquinaId: 4,
        maquina: {
          id: 4,
          nome: "Prensa 02",
          setor: "Usinagem"
        }
      },
      {
        id: 21,
        tipo: "Temperatura",
        status: "OFFLINE",
        maquinaId: 7,
        maquina: {
          id: 7,
          nome: "Prensa 07",
          setor: "Corte"
        }
      }
    ]
  });

  try {
    const result = await prepareWriteToolAction({
      name: "atualizar_limites_sensor",
      args: { tipo: "Temperatura", limiteTemperatura: 95 },
      usuario: admin
    });

    assert.equal(result.kind, "disambiguation");
    assert.equal(result.entity, "sensor");
    assert.equal(result.options.length, 2);
    assert.equal(result.options[1].id, 21);
  } finally {
    SensorService.findByTipo = originalFindByTipo;
  }
});

test("prepareWriteToolAction cria agendamento de relatório", async () => {
  const result = await prepareWriteToolAction({
    name: "criar_agendamento_relatorio",
    args: {
      nome: "Relatório Semanal",
      emailsDestino: ["gestao@orbis.com"],
      assunto: "Resumo semanal",
      periodo: { tipo: "RELATIVE_DAYS", valor: 7 },
      filtros: { secoes: ["resumo", "chamados"] },
      agendamento: { frequencia: "SEMANAL", diaSemana: 1, hora: 8, minuto: 0 }
    },
    usuario: admin
  });

  assert.equal(result.name, "criar_agendamento_relatorio");
  assert.equal(result.summary.nome, "Relatório Semanal");
  assert.equal(result.summary.emailsDestino[0], "gestao@orbis.com");
});

test("prepareWriteToolAction bloqueia visitante em tool de escrita", async () => {
  await assert.rejects(
    () => prepareWriteToolAction({
      name: "criar_agendamento_relatorio",
      args: {},
      usuario: visitante
    }),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 403);
      return true;
    }
  );
});

test("prepareWriteToolAction atualiza agendamento por e-mail com resultado único", async () => {
  const originalFindByDestinatarioEmail = RelatorioAgendamentoService.findByDestinatarioEmail;

  RelatorioAgendamentoService.findByDestinatarioEmail = async () => ([
    {
      id: 9,
      nome: "Relatório Semanal Operacional",
      status: "ATIVO",
      frequencia: "SEMANAL",
      hora: 8,
      minuto: 0,
      diaSemana: 1,
      diaMes: null,
      assunto: "Relatório atual",
      periodo: { tipo: "RELATIVE_DAYS", valor: 7 },
      filtros: { secoes: ["resumo"] },
      secoes: ["resumo"],
      descricaoAgendamento: "Toda segunda às 08:00",
      destinatarios: [{ email: "gestao@orbis.com" }]
    }
  ]);

  try {
    const result = await prepareWriteToolAction({
      name: "atualizar_agendamento_relatorio",
      args: {
        email: "gestao@orbis.com",
        nome: "Relatório Semanal Operacional",
        emailsDestino: ["gestao@orbis.com", "diretoria@orbis.com"],
        assunto: "Relatório novo",
        periodo: { tipo: "RELATIVE_DAYS", valor: 15 },
        filtros: { secoes: ["resumo", "chamados"] },
        agendamento: { frequencia: "SEMANAL", diaSemana: 3, hora: 9, minuto: 30 }
      },
      usuario: admin
    });

    assert.equal(result.name, "atualizar_agendamento_relatorio");
    assert.equal(result.args.id, 9);
    assert.ok(result.summary.alteracoes.length > 0);
  } finally {
    RelatorioAgendamentoService.findByDestinatarioEmail = originalFindByDestinatarioEmail;
  }
});

test("prepareWriteToolAction reativa agendamento por e-mail com resultado único", async () => {
  const originalFindByDestinatarioEmail = RelatorioAgendamentoService.findByDestinatarioEmail;

  RelatorioAgendamentoService.findByDestinatarioEmail = async () => ([
    {
      id: 12,
      nome: "Relatório Diretoria",
      status: "PAUSADO",
      proximoEnvioEm: "2026-05-29 09:00",
      descricaoAgendamento: "Todo dia 01 às 09:00",
      destinatarios: [{ email: "diretoria@orbis.com" }]
    }
  ]);

  try {
    const result = await prepareWriteToolAction({
      name: "reativar_agendamento_relatorio",
      args: { email: "diretoria@orbis.com" },
      usuario: admin
    });

    assert.equal(result.name, "reativar_agendamento_relatorio");
    assert.equal(result.args.id, 12);
  } finally {
    RelatorioAgendamentoService.findByDestinatarioEmail = originalFindByDestinatarioEmail;
  }
});

test("prepareWriteToolAction cria manutenção por alerta", async () => {
  const originalFindById = AlertaService.findById;

  AlertaService.findById = async () => ({
    id: 7,
    tipo: "INSTABILIDADE",
    status: "ATIVO",
    manutencoes: [],
    maquina: {
      id: 3,
      nome: "Prensa 03"
    }
  });

  try {
    const result = await prepareWriteToolAction({
      name: "criar_manutencao_por_alerta",
      args: {
        alertaId: 7,
        observacao: "Verificar vibração fora do padrão"
      },
      usuario: admin
    });

    assert.equal(result.name, "criar_manutencao_por_alerta");
    assert.equal(result.args.alertaId, 7);
    assert.equal(result.summary.maquinaNome, "Prensa 03");
  } finally {
    AlertaService.findById = originalFindById;
  }
});

test("prepareWriteToolAction bloqueia criação de manutenção quando já existe uma em andamento", async () => {
  const originalFindById = AlertaService.findById;

  AlertaService.findById = async () => ({
    id: 7,
    tipo: "INSTABILIDADE",
    status: "ATIVO",
    manutencoes: [{ id: 99, status: "EM_ANDAMENTO" }]
  });

  try {
    await assert.rejects(
      () => prepareWriteToolAction({
        name: "criar_manutencao_por_alerta",
        args: {
          alertaId: 7,
          observacao: "Verificar vibração fora do padrão"
        },
        usuario: admin
      }),
      (error) => error instanceof AppError && error.statusCode === 400
    );
  } finally {
    AlertaService.findById = originalFindById;
  }
});

test("prepareWriteToolAction atualiza manutenção com técnico responsável", async () => {
  const originalFindById = ManutecaoService.findById;

  ManutecaoService.findById = async () => ({
    id: 15,
    alertaId: 7,
    usuarioId: 44,
    status: "EM_ANDAMENTO"
  });

  try {
    const result = await prepareWriteToolAction({
      name: "atualizar_status_manutencao",
      args: {
        id: 15,
        status: "RESOLVIDO",
        observacao: "Troca realizada"
      },
      usuario: { id: 44, role: "TECNICO" }
    });

    assert.equal(result.name, "atualizar_status_manutencao");
    assert.equal(result.args.id, 15);
    assert.equal(result.args.dados.status, "RESOLVIDO");
  } finally {
    ManutecaoService.findById = originalFindById;
  }
});

test("prepareWriteToolAction bloqueia atualização de manutenção por usuário não responsável", async () => {
  const originalFindById = ManutecaoService.findById;

  ManutecaoService.findById = async () => ({
    id: 15,
    alertaId: 7,
    usuarioId: 44,
    status: "EM_ANDAMENTO"
  });

  try {
    await assert.rejects(
      () => prepareWriteToolAction({
        name: "atualizar_status_manutencao",
        args: {
          id: 15,
          status: "RESOLVIDO"
        },
        usuario: { id: 1, role: "ADMIN" }
      }),
      (error) => error instanceof AppError && error.statusCode === 403
    );
  } finally {
    ManutecaoService.findById = originalFindById;
  }
});

test("prepareWriteToolAction bloqueia atualização de manutenção encerrada", async () => {
  const originalFindById = ManutecaoService.findById;

  ManutecaoService.findById = async () => ({
    id: 15,
    alertaId: 7,
    usuarioId: 44,
    status: "RESOLVIDO"
  });

  try {
    await assert.rejects(
      () => prepareWriteToolAction({
        name: "atualizar_status_manutencao",
        args: {
          id: 15,
          status: "ENCERRADO_SEM_SOLUCAO"
        },
        usuario: { id: 44, role: "TECNICO" }
      }),
      (error) => error instanceof AppError && error.statusCode === 409
    );
  } finally {
    ManutecaoService.findById = originalFindById;
  }
});

test("executeWriteTool cria agendamento de relatório", async () => {
  const originalCreate = RelatorioAgendamentoService.create;

  RelatorioAgendamentoService.create = async ({ payload }) => ({
    id: 20,
    nome: payload.nome,
    status: "ATIVO",
    frequencia: payload.agendamento.frequencia,
    hora: payload.agendamento.hora,
    minuto: payload.agendamento.minuto,
    diaSemana: payload.agendamento.diaSemana,
    diaMes: payload.agendamento.diaMes,
    assunto: payload.assunto,
    tipoPeriodo: payload.periodo.tipo,
    periodo: payload.periodo,
    filtros: payload.filtros,
    secoes: payload.filtros.secoes,
    proximoEnvioEm: "2026-05-29 08:00",
    ultimoEnvioEm: null,
    ultimoSucessoEm: null,
    ultimoErroEm: null,
    descricaoAgendamento: "Toda segunda às 08:00",
    criadoPor: { id: 1, nome: "Admin", email: "admin@orbis.com", role: "ADMIN" },
    destinatarios: [{ id: 1, email: "gestao@orbis.com", nome: null, criadoEm: "2026-05-20T12:00:00.000Z" }]
  });

  try {
    const result = await executeWriteTool({
      action: {
        name: "criar_agendamento_relatorio",
        args: {
          nome: "Relatório Semanal",
          emailsDestino: ["gestao@orbis.com"],
          assunto: "Resumo semanal",
          periodo: { tipo: "RELATIVE_DAYS", valor: 7 },
          filtros: { secoes: ["resumo"] },
          agendamento: { frequencia: "SEMANAL", diaSemana: 1, hora: 8, minuto: 0 }
        }
      },
      usuario: admin
    });

    assert.equal(result.message, "Agendamento criado com sucesso.");
    assert.equal(result.agendamento.id, 20);
  } finally {
    RelatorioAgendamentoService.create = originalCreate;
  }
});

test("executeWriteTool cria manutenção por alerta", async () => {
  const originalCreate = ManutecaoService.create;

  ManutecaoService.create = async () => ({
    id: 31,
    alertaId: 7,
    usuarioId: 1,
    observacao: "Verificar vibração fora do padrão",
    status: "EM_ANDAMENTO"
  });

  try {
    const result = await executeWriteTool({
      action: {
        name: "criar_manutencao_por_alerta",
        args: {
          alertaId: 7,
          observacao: "Verificar vibração fora do padrão"
        }
      },
      usuario: admin
    });

    assert.equal(result.message, "Manutenção criada com sucesso.");
    assert.equal(result.manutencao.id, 31);
  } finally {
    ManutecaoService.create = originalCreate;
  }
});
