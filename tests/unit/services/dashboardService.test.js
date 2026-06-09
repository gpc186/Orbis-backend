const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");

const DashboardService = require("../../../src/services/dashboardService");
const AlertaService = require("../../../src/services/alertaService");
const MaquinaService = require("../../../src/services/maquinaService");
const SensorService = require("../../../src/services/sensorService");
const UsuarioService = require("../../../src/services/usuarioService");
const AlertaModel = require("../../../src/models/alertaModel");
const MaquinaModel = require("../../../src/models/maquinaModel");
const SensorModel = require("../../../src/models/sensorModel");

const originals = {
  count: MaquinaService.count,
  countMaquinasWithAlerta: AlertaService.countMaquinasWithAlerta,
  countActiveAlertas: AlertaService.countActiveAlertas,
  countAlertasToday: AlertaService.countAlertasToday,
  countActiveTecnicos: UsuarioService.countActiveTecnicos,
  calculateAverageIntegrity: MaquinaService.calculateAverageIntegrity,
  countActive: SensorService.countActive,
  countAlertaSemAtendimento: AlertaService.countAlertaSemAtendimento,
  countAtendedToday: AlertaService.countAtendedToday,
  getSlaSummary: AlertaService.getSlaSummary,
  listTopAtivos: AlertaModel.listTopAtivos,
  listPioresIntegridade: MaquinaModel.listPioresIntegridade,
  listOfflineRecentes: SensorModel.listOfflineRecentes
};

afterEach(() => {
  MaquinaService.count = originals.count;
  AlertaService.countMaquinasWithAlerta = originals.countMaquinasWithAlerta;
  AlertaService.countActiveAlertas = originals.countActiveAlertas;
  AlertaService.countAlertasToday = originals.countAlertasToday;
  UsuarioService.countActiveTecnicos = originals.countActiveTecnicos;
  MaquinaService.calculateAverageIntegrity = originals.calculateAverageIntegrity;
  SensorService.countActive = originals.countActive;
  AlertaService.countAlertaSemAtendimento = originals.countAlertaSemAtendimento;
  AlertaService.countAtendedToday = originals.countAtendedToday;
  AlertaService.getSlaSummary = originals.getSlaSummary;
  AlertaModel.listTopAtivos = originals.listTopAtivos;
  MaquinaModel.listPioresIntegridade = originals.listPioresIntegridade;
  SensorModel.listOfflineRecentes = originals.listOfflineRecentes;
});

test("resume agrega indicadores principais do dashboard", async () => {
  MaquinaService.count = async () => 10;
  AlertaService.countMaquinasWithAlerta = async () => 3;
  AlertaService.countActiveAlertas = async () => 5;
  AlertaService.countAlertasToday = async () => 2;
  UsuarioService.countActiveTecnicos = async () => 4;
  MaquinaService.calculateAverageIntegrity = async () => ({ _avg: { integridade: 87.5 } });
  SensorService.countActive = async () => 8;
  AlertaService.countAlertaSemAtendimento = async () => 1;
  AlertaService.countAtendedToday = async () => 6;
  AlertaService.getSlaSummary = async () => ({
    slaAtendimentoEmRisco: 1,
    slaAtendimentoAtrasado: 2,
    slaResolucaoEmRisco: 3,
    slaResolucaoAtrasado: 4
  });

  const resumo = await DashboardService.resume();

  assert.deepEqual(resumo, {
    totalMaquinas: 10,
    maquinasEmAlerta: 3,
    maquinasFuncionando: 7,
    alertasAtivos: 5,
    alertasHoje: 2,
    tecnicosAtivos: 4,
    integridadeMedia: 87.5,
    sensoresOnline: 8,
    alertaSemAtendimento: 1,
    alertasAtendidosHoje: 6,
    slaAtendimentoEmRisco: 1,
    slaAtendimentoAtrasado: 2,
    slaResolucaoEmRisco: 3,
    slaResolucaoAtrasado: 4
  });
});

test("buildDestaquesFromResumo gera mensagens apenas para itens acionaveis", () => {
  const destaques = DashboardService.buildDestaquesFromResumo({
    alertasAtivos: 2,
    maquinasEmAlerta: 1,
    alertaSemAtendimento: 0
  });

  assert.deepEqual(destaques, [
    "2 alertas ativos no momento.",
    "1 maquinas em alerta."
  ]);
});

test("listas do dashboard normalizam limit antes de consultar models", async () => {
  const chamadas = [];
  AlertaModel.listTopAtivos = async ({ limit }) => {
    chamadas.push(["alertas", limit]);
    return [];
  };
  MaquinaModel.listPioresIntegridade = async ({ limit }) => {
    chamadas.push(["maquinas", limit]);
    return [];
  };
  SensorModel.listOfflineRecentes = async ({ limit }) => {
    chamadas.push(["sensores", limit]);
    return [];
  };

  await DashboardService.getTopAlertas({ limit: "999" });
  await DashboardService.getMaquinasCriticas({ limit: "-1" });
  await DashboardService.getSensoresOffline({ limit: "abc" });

  assert.deepEqual(chamadas, [
    ["alertas", 20],
    ["maquinas", 1],
    ["sensores", 5]
  ]);
});

test("getTopAlertas adiciona SLA aos alertas do dashboard", async () => {
  AlertaModel.listTopAtivos = async () => [{
    id: 1,
    tipo: "LIMITE_ULTRAPASSADO",
    status: "ATIVO",
    criadoEm: new Date("2026-06-09T10:00:00.000Z"),
    encerradoEm: null,
    maquina: {
      id: 2,
      nome: "Prensa",
      criticidade: "ALTA"
    },
    eventos: [],
    manutencoes: []
  }];

  const result = await DashboardService.getTopAlertas({ limit: 3 });

  assert.equal(result[0].sla.criticidade, "ALTA");
  assert.equal(result[0].sla.atendimento.limiteMinutos, 30);
  assert.equal(Object.hasOwn(result[0], "eventos"), false);
  assert.equal(Object.hasOwn(result[0], "manutencoes"), false);
});

test("getOperationalContext combina resumo, listas e destaques", async () => {
  const resumo = {
    totalMaquinas: 4,
    maquinasEmAlerta: 1,
    maquinasFuncionando: 3,
    alertasAtivos: 2,
    alertasHoje: 1,
    tecnicosAtivos: 2,
    integridadeMedia: 91,
    sensoresOnline: 7,
    alertaSemAtendimento: 1,
    alertasAtendidosHoje: 3
  };

  const originalResume = DashboardService.resume;
  DashboardService.resume = async () => resumo;
  AlertaModel.listTopAtivos = async () => [{ id: 1 }];
  MaquinaModel.listPioresIntegridade = async () => [{ id: 2 }];
  SensorModel.listOfflineRecentes = async () => [{ id: 3 }];

  try {
    const context = await DashboardService.getOperationalContext({ limit: 3 });

    assert.deepEqual(context.resumo, resumo);
    assert.equal(context.topAlertas[0].id, 1);
    assert.equal(context.topAlertas[0].sla.criticidade, "BAIXA");
    assert.deepEqual(context.maquinasCriticas, [{ id: 2 }]);
    assert.deepEqual(context.sensoresOffline, [{ id: 3 }]);
    assert.deepEqual(context.destaques, [
      "2 alertas ativos no momento.",
      "1 maquinas em alerta.",
      "1 alertas sem atendimento."
    ]);
  } finally {
    DashboardService.resume = originalResume;
  }
});
