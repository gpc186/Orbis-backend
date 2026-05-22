const assert = require("node:assert/strict");
const test = require("node:test");

const UsuarioService = require("../usuarioService");
const SensorService = require("../sensorService");
const AlertaService = require("../alertaService");
const MaquinaService = require("../maquinaService");
const ManutecaoService = require("../manutencaoService");
const RelatorioAgendamentoService = require("../relatorioAgendamentoService");
const RelatorioExecucaoService = require("../relatorioExecucaoService");
const AppError = require("../../utils/appErrorUtils");
const { executeTool } = require("./registry");

const admin = { id: 1, role: "ADMIN" };

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
