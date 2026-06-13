const assert = require("node:assert/strict");
const test = require("node:test");

const MaquinaModel = require("../../../src/models/maquinaModel");
const HistoricoIntegridadeModel = require("../../../src/models/historicoIntegridadeModel");
const PredicaoRiscoService = require("../../../src/services/predicaoRiscoService");
const PredicaoService = require("../../../src/services/predicaoService");
const ManutencaoService = require("../../../src/services/manutencaoService");

const RealDate = Date;

const PREDICAO_TEST_DEFAULTS = {
  PREDICAO_MIN_PONTOS_REGRESSAO: "3",
  PREDICAO_MIN_JANELA_REGRESSAO_HORAS: "0.05",
  PREDICAO_MIN_INTERVALO_REGRESSAO_HORAS: "0.005",
  PREDICAO_MAX_RAZAO_INTERVALO_REGRESSAO: "60"
};

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

function withPredicaoTestDefaults(run) {
  return withEnv(PREDICAO_TEST_DEFAULTS, run);
}

function buildHistorico(valores, startIso = "2026-05-21T00:00:00.000Z", stepHours = 1) {
  const inicio = new RealDate(startIso).getTime();

  return valores.map((integridade, index) => ({
    id: index + 1,
    maquinaId: 1,
    integridade,
    scoreEstabilidade: integridade,
    criadoEm: new RealDate(inicio + (index * stepHours * 60 * 60 * 1000)).toISOString()
  }));
}

function mockPredicaoDependencies({
  historico,
  machine = {
    id: 1,
    nome: "Maquina teste",
    integridade: 82,
    scoreEstabilidade: 76
  },
  riskResult = {
    riscos: {
      manutencao: {
        "24h": 0.2,
        "72h": 0.3,
        classificacao: "BAIXO",
        motivoAusencia: null
      }
    }
  }
}) {
  const originalFindById = MaquinaModel.findById;
  const originalUpdate = MaquinaModel.update;
  const originalFindSerieByMaquina = HistoricoIntegridadeModel.findSerieByMaquina;
  const originalPreverPorMaquina = PredicaoRiscoService.preverPorMaquina;
  const originalSyncPreventivaPreditiva = ManutencaoService.syncPreventivaPreditiva;

  const updateCalls = [];
  const syncCalls = [];

  MaquinaModel.findById = async () => machine;
  MaquinaModel.update = async (id, data) => {
    updateCalls.push({ id, data });
    return { id, ...data };
  };
  HistoricoIntegridadeModel.findSerieByMaquina = async () => historico;
  PredicaoRiscoService.preverPorMaquina = async () => riskResult;
  ManutencaoService.syncPreventivaPreditiva = async (diagnostico) => {
    syncCalls.push(diagnostico);
    return null;
  };

  return {
    updateCalls,
    syncCalls,
    restore() {
      MaquinaModel.findById = originalFindById;
      MaquinaModel.update = originalUpdate;
      HistoricoIntegridadeModel.findSerieByMaquina = originalFindSerieByMaquina;
      PredicaoRiscoService.preverPorMaquina = originalPreverPorMaquina;
      ManutencaoService.syncPreventivaPreditiva = originalSyncPreventivaPreditiva;
    }
  };
}

test("calcularIntegridadeAgregada reduz a media quando existe sensor em estado critico", async () => {
  const resultado = PredicaoService.calcularIntegridadeAgregada([92, 88, 22]);

  assert.equal(resultado, 47.33);
});

test("obterConfigPredicao permite calibrar velocidade por variaveis de ambiente", async () => {
  await withEnv({
    PREDICAO_MIN_PONTOS_REGRESSAO: "4",
    PREDICAO_MIN_JANELA_REGRESSAO_HORAS: "0.1",
    PREDICAO_MIN_INTERVALO_REGRESSAO_HORAS: "0.01",
    PREDICAO_MAX_RAZAO_INTERVALO_REGRESSAO: "30"
  }, () => {
    assert.deepEqual(PredicaoService.obterConfigPredicao(), {
      minPontosRegressao: 4,
      minJanelaRegressaoHoras: 0.1,
      minIntervaloRegressaoHoras: 0.01,
      maxRazaoIntervaloRegressao: 30
    });
  });
});

test("previsaoManutencao retorna SEM_DADOS quando nao ha historico suficiente", async () => {
  const restoreDate = useFakeNow("2026-05-21T07:00:00.000Z");
  const mocks = mockPredicaoDependencies({
    historico: buildHistorico([100, 99])
  });

  try {
    await withPredicaoTestDefaults(async () => {
      const resultado = await PredicaoService.previsaoManutencao(1);

      assert.equal(mocks.updateCalls.length, 1);
      assert.deepEqual(mocks.updateCalls[0].data, {
        previsaoManutencao: null,
        janelaManuInicio: null,
        janelaManuFim: null
      });
      assert.equal(resultado.estadoPredicao, PredicaoService.ESTADOS.SEM_DADOS);
      assert.equal(resultado.fonteDecisao, PredicaoService.FONTES.SEM_MODELO);
      assert.equal(resultado.motivo, PredicaoService.MOTIVOS.HISTORICO_INSUFICIENTE);
      assert.equal(mocks.syncCalls.length, 1);
    });
  } finally {
    mocks.restore();
    restoreDate();
  }
});

test("previsaoManutencao aceita serie de poucos minutos no fluxo normal", async () => {
  const restoreDate = useFakeNow("2026-05-21T00:04:00.000Z");
  const mocks = mockPredicaoDependencies({
    historico: buildHistorico(
      [100, 99, 98],
      "2026-05-21T00:00:00.000Z",
      0.025
    )
  });

  try {
    await withPredicaoTestDefaults(async () => {
      const resultado = await PredicaoService.previsaoManutencao(1);

      assert.equal(mocks.updateCalls.length, 1);
      assert.equal(resultado.estadoPredicao, PredicaoService.ESTADOS.PREVISAO_VALIDA);
      assert.equal(resultado.fonteDecisao, PredicaoService.FONTES.REGRESSAO_LINEAR);
      assert.equal(resultado.modeloIntegridade.pontosUsados, 3);
      assert.equal(resultado.modeloIntegridade.janelaHorasCoberta, 0.05);
      assert.equal(mocks.updateCalls[0].data.previsaoManutencao.toISOString(), "2026-05-21T01:45:00.000Z");
      assert.equal(mocks.syncCalls.length, 1);
    });
  } finally {
    mocks.restore();
    restoreDate();
  }
});

test("previsaoManutencao marca MANUTENCAO_IMEDIATA quando a integridade atual ja cruzou o limiar", async () => {
  const restoreDate = useFakeNow("2026-05-21T07:00:00.000Z");
  const mocks = mockPredicaoDependencies({
    historico: buildHistorico([100, 40, 95, 35, 90, 30, 85, 25]),
    machine: {
      id: 1,
      nome: "Maquina critica",
      integridade: 64,
      scoreEstabilidade: 58
    }
  });

  try {
    await withPredicaoTestDefaults(async () => {
      const resultado = await PredicaoService.previsaoManutencao(1);

      assert.deepEqual(mocks.updateCalls[0].data, {
        previsaoManutencao: null,
        janelaManuInicio: null,
        janelaManuFim: null
      });
      assert.equal(resultado.estadoPredicao, PredicaoService.ESTADOS.MANUTENCAO_IMEDIATA);
      assert.equal(resultado.fonteDecisao, PredicaoService.FONTES.HEURISTICA_CRITICA);
      assert.equal(resultado.urgencia, PredicaoService.URGENCIAS.IMEDIATA);
      assert.equal(resultado.motivo, PredicaoService.MOTIVOS.LIMIAR_MANUTENCAO_JA_CRUZADO);
    });
  } finally {
    mocks.restore();
    restoreDate();
  }
});

test("previsaoManutencao marca FALHA_JA_CRUZADA quando a integridade atual ja cruzou o limiar de falha", async () => {
  const restoreDate = useFakeNow("2026-05-21T08:00:00.000Z");
  const mocks = mockPredicaoDependencies({
    historico: buildHistorico([100, 90, 80, 70, 60, 50, 40, 20]),
    machine: {
      id: 1,
      nome: "Maquina falhando",
      integridade: 24,
      scoreEstabilidade: 18
    }
  });

  try {
    await withPredicaoTestDefaults(async () => {
      const resultado = await PredicaoService.previsaoManutencao(1);

      assert.equal(resultado.estadoPredicao, PredicaoService.ESTADOS.FALHA_JA_CRUZADA);
      assert.equal(resultado.motivo, PredicaoService.MOTIVOS.LIMIAR_FALHA_JA_CRUZADO);
      assert.equal(resultado.urgencia, PredicaoService.URGENCIAS.IMEDIATA);
    });
  } finally {
    mocks.restore();
    restoreDate();
  }
});

test("previsaoManutencao usa fallback heuristico quando o modelo e invalido mas o risco e alto", async () => {
  const restoreDate = useFakeNow("2026-05-21T07:00:00.000Z");
  const mocks = mockPredicaoDependencies({
    historico: buildHistorico([100, 40, 95, 35, 90, 30, 85, 25]),
    machine: {
      id: 1,
      nome: "Maquina instavel",
      integridade: 76,
      scoreEstabilidade: 58
    },
    riskResult: {
      riscos: {
        manutencao: {
          "24h": 0.76,
          "72h": 0.83,
          classificacao: "ALTO",
          motivoAusencia: null
        }
      }
    }
  });

  try {
    await withPredicaoTestDefaults(async () => {
      const resultado = await PredicaoService.previsaoManutencao(1);

      assert.equal(resultado.estadoPredicao, PredicaoService.ESTADOS.MODELO_INVALIDO_COM_RISCO);
      assert.equal(resultado.fonteDecisao, PredicaoService.FONTES.HEURISTICA_CRITICA);
      assert.equal(resultado.motivo, PredicaoService.MOTIVOS.RISCO_HEURISTICO_CRITICO);
    });
  } finally {
    mocks.restore();
    restoreDate();
  }
});

test("previsaoManutencao gera janela futura quando a regressao linear permanece valida", async () => {
  const restoreDate = useFakeNow("2026-05-21T07:00:00.000Z");
  const mocks = mockPredicaoDependencies({
    historico: buildHistorico([100, 99, 98, 97, 96, 95, 94, 93])
  });

  try {
    await withPredicaoTestDefaults(async () => {
      const resultado = await PredicaoService.previsaoManutencao(1);

      assert.equal(mocks.updateCalls.length, 1);

      const payload = mocks.updateCalls[0].data;
      assert.equal(resultado.estadoPredicao, PredicaoService.ESTADOS.PREVISAO_VALIDA);
      assert.equal(payload.previsaoManutencao.toISOString(), "2026-05-23T22:00:00.000Z");
      assert.equal(payload.janelaManuInicio.toISOString(), "2026-05-22T06:00:00.000Z");
      assert.equal(payload.janelaManuFim.toISOString(), "2026-05-22T06:00:00.000Z");
      assert.equal(resultado.modeloIntegridade.janelaHorasCoberta, 7);
      assert.equal(resultado.modeloIntegridade.ultimoPontoEm.toISOString(), "2026-05-21T07:00:00.000Z");
    });
  } finally {
    mocks.restore();
    restoreDate();
  }
});

test("avaliarModeloIntegridade invalida series temporais concentradas demais", async () => {
  const restoreDate = useFakeNow("2026-05-21T07:00:00.000Z");
  const historicoConcentrado = buildHistorico(
    [100, 99, 98, 97, 96, 95, 94, 93],
    "2026-05-21T00:00:00.000Z",
    0.001
  );
  const mocks = mockPredicaoDependencies({ historico: historicoConcentrado });

  try {
    await withPredicaoTestDefaults(async () => {
      const resultado = await PredicaoService.avaliarModeloIntegridade(1);

      assert.equal(resultado.valido, false);
      assert.equal(resultado.motivo, PredicaoService.MOTIVOS.JANELA_TEMPORAL_INSUFICIENTE);
      assert.equal(PredicaoService.resumirModeloIntegridade(resultado).janelaHorasCoberta, 0.01);
    });
  } finally {
    mocks.restore();
    restoreDate();
  }
});
