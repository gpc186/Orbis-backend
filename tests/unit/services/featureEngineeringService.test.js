const assert = require("node:assert/strict");
const test = require("node:test");

const AlertaModel = require("../../../src/models/alertaModel");
const HistoricoIntegridadeModel = require("../../../src/models/historicoIntegridadeModel");
const LeituraModel = require("../../../src/models/leituraModel");
const MaquinaModel = require("../../../src/models/maquinaModel");
const FeatureEngineeringService = require("../../../src/services/featureEngineeringService");

const RealDate = Date;

function useFakeNow(isoString) {
  const fixedNow = new RealDate(isoString);

  global.Date = class FakeDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) {
        return new RealDate(fixedNow);
      }

      return new RealDate(...args);
    }

    static now() {
      return fixedNow.getTime();
    }

    static parse(value) {
      return RealDate.parse(value);
    }

    static UTC(...args) {
      return RealDate.UTC(...args);
    }
  };

  return () => {
    global.Date = RealDate;
  };
}

function withEnv(overrides, run) {
  const previous = {};

  for (const key of Object.keys(overrides)) {
    previous[key] = process.env[key];
    process.env[key] = overrides[key];
  }

  return Promise.resolve()
    .then(run)
    .finally(() => {
      for (const key of Object.keys(overrides)) {
        if (previous[key] === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = previous[key];
        }
      }
    });
}

function createReading({ iso, temperatura, vibracao, sensorOverrides = {} }) {
  return {
    id: Math.random(),
    criadoEm: iso,
    temperatura,
    vibracao,
    sensor: {
      id: 1,
      tipo: "VIB_TEMP",
      limiteTemperatura: 80,
      idealTemperatura: 60,
      limiteVibracao: 10,
      idealVibracao: 5,
      desvioMaximoTemp: 5,
      desvioMaximoVibra: 2,
      ...sensorOverrides
    }
  };
}

function createHistorico({ iso, integridade, scoreEstabilidade }) {
  return {
    id: Math.random(),
    maquinaId: 1,
    criadoEm: iso,
    integridade,
    scoreEstabilidade
  };
}

function createAlerta({ iso, tipo, status = "ATIVO" }) {
  return {
    id: Math.random(),
    maquinaId: 1,
    sensorId: 1,
    tipo,
    status,
    criadoEm: iso,
    encerradoEm: null
  };
}

function mockFeatureDependencies({ machine, historico, leituras, alertasRecentes, alertasAtivos }) {
  const originalFindById = MaquinaModel.findById;
  const originalFindSerieByMaquina = HistoricoIntegridadeModel.findSerieByMaquina;
  const originalFindByMaquinaPeriodoLeituras = LeituraModel.findByMaquinaPeriodo;
  const originalFindByMaquinaPeriodoAlertas = AlertaModel.findByMaquinaPeriodo;

  MaquinaModel.findById = async () => machine;
  HistoricoIntegridadeModel.findSerieByMaquina = async () => historico;
  LeituraModel.findByMaquinaPeriodo = async () => leituras;
  AlertaModel.findByMaquinaPeriodo = async (_maquinaId, options = {}) => {
    if (Array.isArray(options.statuses) && options.statuses.length) {
      return alertasAtivos;
    }

    return alertasRecentes;
  };

  return {
    restore() {
      MaquinaModel.findById = originalFindById;
      HistoricoIntegridadeModel.findSerieByMaquina = originalFindSerieByMaquina;
      LeituraModel.findByMaquinaPeriodo = originalFindByMaquinaPeriodoLeituras;
      AlertaModel.findByMaquinaPeriodo = originalFindByMaquinaPeriodoAlertas;
    }
  };
}

test("obterConfig permite calibrar cobertura de risco por variaveis de ambiente", async () => {
  await withEnv({
    PREDICAO_RISCO_MIN_PONTOS_HISTORICO: "5",
    PREDICAO_RISCO_MIN_LEITURAS_24H: "4",
    PREDICAO_RISCO_MIN_LEITURAS_72H: "6",
    PREDICAO_RISCO_LEITURA_RECENTE_HORAS: "2"
  }, () => {
    assert.deepEqual(FeatureEngineeringService.obterConfig(), {
      minPontosHistorico: 5,
      minLeituras24h: 4,
      minLeituras72h: 6,
      limiarLeituraRecenteHoras: 2
    });
  });
});

test("buildMachineFeatureSet agrega features e cobertura com dados completos", async () => {
  const restoreDate = useFakeNow("2026-05-22T12:00:00.000Z");

  const machine = {
    id: 1,
    nome: "Prensa 01",
    tipo: "PRENSA",
    setor: "Linha A",
    criticidade: "ALTA",
    integridade: 74,
    scoreEstabilidade: 68,
    sensores: [
      {
        id: 1,
        ultimaLeituraEm: "2026-05-22T11:30:00.000Z"
      }
    ]
  };

  const historico = [
    createHistorico({ iso: "2026-05-21T00:00:00.000Z", integridade: 92, scoreEstabilidade: 88 }),
    createHistorico({ iso: "2026-05-21T06:00:00.000Z", integridade: 90, scoreEstabilidade: 85 }),
    createHistorico({ iso: "2026-05-21T12:00:00.000Z", integridade: 87, scoreEstabilidade: 82 }),
    createHistorico({ iso: "2026-05-21T18:00:00.000Z", integridade: 84, scoreEstabilidade: 78 }),
    createHistorico({ iso: "2026-05-22T00:00:00.000Z", integridade: 81, scoreEstabilidade: 74 }),
    createHistorico({ iso: "2026-05-22T04:00:00.000Z", integridade: 79, scoreEstabilidade: 72 }),
    createHistorico({ iso: "2026-05-22T08:00:00.000Z", integridade: 76, scoreEstabilidade: 70 }),
    createHistorico({ iso: "2026-05-22T11:00:00.000Z", integridade: 74, scoreEstabilidade: 68 })
  ];

  const leituras = [
    createReading({ iso: "2026-05-19T12:00:00.000Z", temperatura: 61, vibracao: 5.1 }),
    createReading({ iso: "2026-05-20T12:00:00.000Z", temperatura: 62, vibracao: 5.3 }),
    createReading({ iso: "2026-05-21T00:00:00.000Z", temperatura: 63, vibracao: 5.5 }),
    createReading({ iso: "2026-05-21T06:00:00.000Z", temperatura: 64, vibracao: 5.7 }),
    createReading({ iso: "2026-05-21T12:00:00.000Z", temperatura: 65, vibracao: 5.9 }),
    createReading({ iso: "2026-05-21T16:00:00.000Z", temperatura: 68, vibracao: 6.4 }),
    createReading({ iso: "2026-05-21T20:00:00.000Z", temperatura: 71, vibracao: 7.2 }),
    createReading({ iso: "2026-05-22T00:00:00.000Z", temperatura: 74, vibracao: 7.8 }),
    createReading({ iso: "2026-05-22T04:00:00.000Z", temperatura: 76, vibracao: 8.6 }),
    createReading({ iso: "2026-05-22T06:00:00.000Z", temperatura: 78, vibracao: 9.2 }),
    createReading({ iso: "2026-05-22T08:00:00.000Z", temperatura: 81, vibracao: 10.5 }),
    createReading({ iso: "2026-05-22T10:00:00.000Z", temperatura: 79, vibracao: 9.8 }),
    createReading({ iso: "2026-05-22T11:00:00.000Z", temperatura: 77, vibracao: 8.9 }),
    createReading({ iso: "2026-05-22T11:30:00.000Z", temperatura: 76, vibracao: 8.4 })
  ];

  const alertasRecentes = [
    createAlerta({ iso: "2026-05-22T01:00:00.000Z", tipo: "INSTABILIDADE" }),
    createAlerta({ iso: "2026-05-22T05:00:00.000Z", tipo: "TENDENCIA_CURTA" }),
    createAlerta({ iso: "2026-05-22T07:00:00.000Z", tipo: "LIMITE_ULTRAPASSADO" }),
    createAlerta({ iso: "2026-05-20T10:00:00.000Z", tipo: "TENDENCIA_LONGA", status: "RESOLVIDO" })
  ];

  const alertasAtivos = [
    createAlerta({ iso: "2026-05-22T05:00:00.000Z", tipo: "TENDENCIA_CURTA", status: "ATIVO" }),
    createAlerta({ iso: "2026-05-22T07:00:00.000Z", tipo: "LIMITE_ULTRAPASSADO", status: "EM_ANDAMENTO" })
  ];

  const mocks = mockFeatureDependencies({ machine, historico, leituras, alertasRecentes, alertasAtivos });

  try {
    const resultado = await FeatureEngineeringService.buildMachineFeatureSet(1);

    assert.equal(resultado.metadados.pontosHistoricoIntegridade, 8);
    assert.equal(resultado.metadados.leiturasConsideradas, 14);
    assert.equal(resultado.metadados.alertasRecentesConsiderados, 4);
    assert.equal(resultado.features.integridadeAtual, 74);
    assert.equal(resultado.features.scoreEstabilidadeAtual, 68);
    assert.equal(resultado.features.temperaturaMedia2h > 76, true);
    assert.equal(resultado.features.vibracaoMedia24h > 8, true);
    assert.equal(resultado.features.proporcaoLeiturasAcimaDoIdeal24h > 0.8, true);
    assert.equal(resultado.features.proporcaoLeiturasAcimaDoLimite24h > 0, true);
    assert.equal(resultado.features.alertasAtivos, 2);
    assert.equal(resultado.features.alertasUltimas24h, 3);
    assert.equal(resultado.features.alertasUltimas72h, 4);
    assert.equal(resultado.features.instabilidadesUltimas72h, 1);
    assert.equal(resultado.features.tendenciasCurtasUltimas72h, 1);
    assert.equal(resultado.features.tendenciasLongasUltimas7d, 1);
    assert.equal(resultado.coverage.historicoIntegridadeSuficiente, true);
    assert.equal(resultado.coverage.leituras24hSuficientes, true);
    assert.equal(resultado.coverage.leituras72hSuficientes, true);
    assert.equal(resultado.coverage.leituraRecenteDisponivel, true);
    assert.equal(resultado.coverage.baseAlertasSuficiente, true);
    assert.deepEqual(resultado.motivosCobertura, []);
  } finally {
    mocks.restore();
    restoreDate();
  }
});

test("buildMachineFeatureSet sinaliza motivos de cobertura insuficiente", async () => {
  const restoreDate = useFakeNow("2026-05-22T12:00:00.000Z");

  const machine = {
    id: 1,
    nome: "Prensa 02",
    tipo: "PRENSA",
    setor: "Linha B",
    criticidade: "MEDIA",
    integridade: 91,
    scoreEstabilidade: 89,
    sensores: [
      {
        id: 1,
        ultimaLeituraEm: "2026-05-21T00:00:00.000Z"
      }
    ]
  };

  const historico = [
    createHistorico({ iso: "2026-05-22T00:00:00.000Z", integridade: 92, scoreEstabilidade: 90 }),
    createHistorico({ iso: "2026-05-22T06:00:00.000Z", integridade: 91, scoreEstabilidade: 89 })
  ];

  const leituras = [
    createReading({ iso: "2026-05-21T00:00:00.000Z", temperatura: 60, vibracao: 5.0 }),
    createReading({ iso: "2026-05-21T04:00:00.000Z", temperatura: 60.5, vibracao: 5.1 }),
    createReading({ iso: "2026-05-21T08:00:00.000Z", temperatura: 61, vibracao: 5.0 })
  ];

  const mocks = mockFeatureDependencies({
    machine,
    historico,
    leituras,
    alertasRecentes: [],
    alertasAtivos: []
  });

  try {
    const resultado = await FeatureEngineeringService.buildMachineFeatureSet(1);

    assert.equal(resultado.coverage.historicoIntegridadeSuficiente, false);
    assert.equal(resultado.coverage.leituras24hSuficientes, false);
    assert.equal(resultado.coverage.leituraRecenteDisponivel, false);
    assert.equal(resultado.coverage.baseAlertasSuficiente, false);
    assert.deepEqual(resultado.motivosCobertura, [
      "historico_insuficiente",
      "leituras_insuficientes",
      "sem_leitura_recente",
      "historico_de_alertas_insuficiente"
    ]);
  } finally {
    mocks.restore();
    restoreDate();
  }
});
