const assert = require("node:assert/strict");
const test = require("node:test");

const AlertaModel = require("../models/alertaModel");
const HistoricoIntegridadeModel = require("../models/historicoIntegridadeModel");
const MaquinaModel = require("../models/maquinaModel");
const PredicaoService = require("./predicaoService");
const AlertaPreditivoService = require("./alertaPreditivoService");

function createModelResult({
  r2 = 0.84,
  slope = -1,
  intercept = 100,
  dataBase = "2026-05-21T00:00:00.000Z",
  referenceTime = "2026-05-21T06:00:00.000Z",
  points = 30,
  computeX
} = {}) {
  return {
    disponivel: true,
    valido: true,
    motivo: null,
    modeloIntegridade: {
      modelo: {
        computeX: computeX || ((limiar) => 100 - limiar)
      },
      score: { r2 },
      slope,
      intercept,
      dataBase: new Date(dataBase),
      referenciaTemporal: new Date(referenceTime),
      pontosUsados: points
    }
  };
}

function createAlert(id, maquinaId, tipo, criadoEm) {
  return { id, maquinaId, tipo, criadoEm };
}

function mockServiceDependencies({
  machine = { id: 1, tipo: "CNC", nome: "Maquina teste" },
  modelResult = createModelResult(),
  machineAlerts = {},
  typeAlerts = {},
  globalAlerts = {},
  historicoPorAlerta = {}
} = {}) {
  const originalFindById = MaquinaModel.findById;
  const originalObterModeloIntegridade = PredicaoService.obterModeloIntegridade;
  const originalFindByMaquinaAndTipos = AlertaModel.findByMaquinaAndTipos;
  const originalFindByTipoMaquinaAndTipos = AlertaModel.findByTipoMaquinaAndTipos;
  const originalFindByTipos = AlertaModel.findByTipos;
  const originalFindLatestBefore = HistoricoIntegridadeModel.findLatestBefore;

  const chamadasTipos = [];

  MaquinaModel.findById = async () => machine;
  PredicaoService.obterModeloIntegridade = async () => modelResult;
  AlertaModel.findByMaquinaAndTipos = async (_maquinaId, tipos) => {
    chamadasTipos.push({ escopo: "MAQUINA", tipos });
    return machineAlerts[tipos[0]] || [];
  };
  AlertaModel.findByTipoMaquinaAndTipos = async (_tipoMaquina, tipos) => {
    chamadasTipos.push({ escopo: "TIPO_MAQUINA", tipos });
    return typeAlerts[tipos[0]] || [];
  };
  AlertaModel.findByTipos = async (tipos) => {
    chamadasTipos.push({ escopo: "GLOBAL", tipos });
    return globalAlerts[tipos[0]] || [];
  };
  HistoricoIntegridadeModel.findLatestBefore = async (_maquinaId, dataReferencia) => {
    const chave = String(dataReferencia);
    const integridade = historicoPorAlerta[chave];

    if (integridade === undefined) {
      return null;
    }

    return {
      id: 1,
      maquinaId: 1,
      integridade,
      criadoEm: new Date(dataReferencia)
    };
  };

  return {
    chamadasTipos,
    restore() {
      MaquinaModel.findById = originalFindById;
      PredicaoService.obterModeloIntegridade = originalObterModeloIntegridade;
      AlertaModel.findByMaquinaAndTipos = originalFindByMaquinaAndTipos;
      AlertaModel.findByTipoMaquinaAndTipos = originalFindByTipoMaquinaAndTipos;
      AlertaModel.findByTipos = originalFindByTipos;
      HistoricoIntegridadeModel.findLatestBefore = originalFindLatestBefore;
    }
  };
}

test("preverPorMaquina retorna previsoes nulas quando o modelo de integridade nao e valido, mantendo o resumo disponivel", async () => {
  const mocks = mockServiceDependencies({
    modelResult: {
      ...createModelResult(),
      valido: false,
      motivo: "tendencia_nao_confiavel"
    }
  });

  try {
    const resultado = await AlertaPreditivoService.preverPorMaquina(1);

    assert.deepEqual(resultado, {
      maquinaId: 1,
      proximoAlerta: null,
      ausenciaProximoAlerta: {
        motivo: "tendencia_nao_confiavel"
      },
      instabilidade: null,
      ausenciaInstabilidade: {
        motivo: "tendencia_nao_confiavel"
      },
      modeloIntegridade: {
        r2: 0.84,
        slope: -1,
        intercept: 100,
        pontosUsados: 30
      }
    });
  } finally {
    mocks.restore();
  }
});

test("preverPorMaquina usa o limiar da propria maquina quando ha amostras suficientes", async () => {
  const alertaA = createAlert(1, 1, "INSTABILIDADE", "2026-05-20T01:00:00.000Z");
  const alertaB = createAlert(2, 1, "INSTABILIDADE", "2026-05-20T02:00:00.000Z");
  const alertaC = createAlert(3, 1, "INSTABILIDADE", "2026-05-20T03:00:00.000Z");

  const mocks = mockServiceDependencies({
    machineAlerts: {
      INSTABILIDADE: [alertaA, alertaB, alertaC]
    },
    historicoPorAlerta: {
      [alertaA.criadoEm]: 74,
      [alertaB.criadoEm]: 72,
      [alertaC.criadoEm]: 70
    }
  });

  try {
    const resultado = await AlertaPreditivoService.preverPorMaquina(1);

    assert.equal(resultado.proximoAlerta.tipo, "INSTABILIDADE");
    assert.equal(resultado.proximoAlerta.fonteLimiar, "MAQUINA");
    assert.equal(resultado.proximoAlerta.integridadeLimiar, 72);
    assert.equal(resultado.proximoAlerta.amostrasLimiar, 3);
    assert.equal(resultado.proximoAlerta.confianca, 0.25);
    assert.equal(resultado.proximoAlerta.dataPrevista.toISOString(), "2026-05-22T04:00:00.000Z");
    assert.equal(resultado.ausenciaProximoAlerta, null);
    assert.equal(resultado.ausenciaInstabilidade, null);
    assert.deepEqual(resultado.instabilidade, {
      dataPrevista: resultado.proximoAlerta.dataPrevista,
      integridadeLimiar: 72,
      confianca: 0.25,
      fonteLimiar: "MAQUINA",
      amostrasLimiar: 3
    });
  } finally {
    mocks.restore();
  }
});

test("preverPorMaquina faz fallback para o tipo da maquina e escolhe o menor candidato como proximo alerta", async () => {
  const inst1 = createAlert(1, 2, "INSTABILIDADE", "2026-05-20T01:00:00.000Z");
  const inst2 = createAlert(2, 3, "INSTABILIDADE", "2026-05-20T02:00:00.000Z");
  const inst3 = createAlert(3, 4, "INSTABILIDADE", "2026-05-20T03:00:00.000Z");

  const tend1 = createAlert(4, 2, "TENDENCIA_CURTA", "2026-05-20T04:00:00.000Z");
  const tend2 = createAlert(5, 3, "TENDENCIA_CURTA", "2026-05-20T05:00:00.000Z");
  const tend3 = createAlert(6, 4, "TENDENCIA_CURTA", "2026-05-20T06:00:00.000Z");

  const mocks = mockServiceDependencies({
    modelResult: createModelResult({
      computeX: (limiar) => {
        if (limiar === 75) return 8;
        if (limiar === 85) return 7;
        return 20;
      }
    }),
    machineAlerts: {
      INSTABILIDADE: [inst1, inst2],
      TENDENCIA_CURTA: [],
      TENDENCIA_LONGA: []
    },
    typeAlerts: {
      INSTABILIDADE: [inst1, inst2, inst3],
      TENDENCIA_CURTA: [tend1, tend2, tend3]
    },
    historicoPorAlerta: {
      [inst1.criadoEm]: 75,
      [inst2.criadoEm]: 73,
      [inst3.criadoEm]: 77,
      [tend1.criadoEm]: 85,
      [tend2.criadoEm]: 87,
      [tend3.criadoEm]: 83
    }
  });

  try {
    const resultado = await AlertaPreditivoService.preverPorMaquina(1);

    assert.equal(resultado.proximoAlerta.tipo, "TENDENCIA_CURTA");
    assert.equal(resultado.proximoAlerta.fonteLimiar, "TIPO_MAQUINA");
    assert.equal(resultado.proximoAlerta.dataPrevista.toISOString(), "2026-05-21T07:00:00.000Z");
    assert.equal(resultado.ausenciaProximoAlerta, null);
    assert.equal(resultado.ausenciaInstabilidade, null);
    assert.deepEqual(resultado.instabilidade, {
      dataPrevista: new Date("2026-05-21T08:00:00.000Z"),
      integridadeLimiar: 75,
      confianca: 0.25,
      fonteLimiar: "TIPO_MAQUINA",
      amostrasLimiar: 3
    });
  } finally {
    mocks.restore();
  }
});

test("preverPorMaquina faz fallback global quando o tipo da maquina nao tem amostras suficientes", async () => {
  const global1 = createAlert(1, 10, "TENDENCIA_LONGA", "2026-05-20T01:00:00.000Z");
  const global2 = createAlert(2, 11, "TENDENCIA_LONGA", "2026-05-20T02:00:00.000Z");
  const global3 = createAlert(3, 12, "TENDENCIA_LONGA", "2026-05-20T03:00:00.000Z");

  const mocks = mockServiceDependencies({
    machineAlerts: {
      TENDENCIA_LONGA: []
    },
    typeAlerts: {
      TENDENCIA_LONGA: [global1, global2]
    },
    globalAlerts: {
      TENDENCIA_LONGA: [global1, global2, global3]
    },
    historicoPorAlerta: {
      [global1.criadoEm]: 69,
      [global2.criadoEm]: 71,
      [global3.criadoEm]: 70
    }
  });

  try {
    const resultado = await AlertaPreditivoService.preverPorMaquina(1);

    assert.equal(resultado.proximoAlerta.tipo, "TENDENCIA_LONGA");
    assert.equal(resultado.proximoAlerta.fonteLimiar, "GLOBAL");
    assert.equal(resultado.proximoAlerta.integridadeLimiar, 70);
    assert.equal(resultado.proximoAlerta.amostrasLimiar, 3);
    assert.equal(resultado.ausenciaProximoAlerta, null);
  } finally {
    mocks.restore();
  }
});

test("preverPorMaquina ignora previsoes no passado e acima de 90 dias", async () => {
  const alertaCurta1 = createAlert(1, 1, "TENDENCIA_CURTA", "2026-05-20T01:00:00.000Z");
  const alertaCurta2 = createAlert(2, 1, "TENDENCIA_CURTA", "2026-05-20T02:00:00.000Z");
  const alertaCurta3 = createAlert(3, 1, "TENDENCIA_CURTA", "2026-05-20T03:00:00.000Z");
  const alertaLonga1 = createAlert(4, 1, "TENDENCIA_LONGA", "2026-05-20T04:00:00.000Z");
  const alertaLonga2 = createAlert(5, 1, "TENDENCIA_LONGA", "2026-05-20T05:00:00.000Z");
  const alertaLonga3 = createAlert(6, 1, "TENDENCIA_LONGA", "2026-05-20T06:00:00.000Z");

  const mocks = mockServiceDependencies({
    modelResult: createModelResult({
      computeX: (limiar) => {
        if (limiar === 95) return 2;
        if (limiar === 10) return 24 * 120;
        return 15;
      }
    }),
    machineAlerts: {
      TENDENCIA_CURTA: [alertaCurta1, alertaCurta2, alertaCurta3],
      TENDENCIA_LONGA: [alertaLonga1, alertaLonga2, alertaLonga3]
    },
    historicoPorAlerta: {
      [alertaCurta1.criadoEm]: 95,
      [alertaCurta2.criadoEm]: 95,
      [alertaCurta3.criadoEm]: 95,
      [alertaLonga1.criadoEm]: 10,
      [alertaLonga2.criadoEm]: 10,
      [alertaLonga3.criadoEm]: 10
    }
  });

  try {
    const resultado = await AlertaPreditivoService.preverPorMaquina(1);

    assert.equal(resultado.proximoAlerta, null);
    assert.deepEqual(resultado.ausenciaProximoAlerta, {
      motivo: "sem_alerta_previsivel"
    });
    assert.equal(resultado.instabilidade, null);
    assert.deepEqual(resultado.ausenciaInstabilidade, {
      motivo: "sem_historico_de_alertas_do_tipo",
      tipo: "INSTABILIDADE"
    });
  } finally {
    mocks.restore();
  }
});

test("preverPorMaquina consulta apenas os tipos suportados e exclui LIMITE_ULTRAPASSADO", async () => {
  const mocks = mockServiceDependencies();

  try {
    await AlertaPreditivoService.preverPorMaquina(1);

    const tiposConsultados = new Set(
      mocks.chamadasTipos.flatMap((chamada) => chamada.tipos)
    );

    assert.deepEqual([...tiposConsultados].sort(), [
      "INSTABILIDADE",
      "TENDENCIA_CURTA",
      "TENDENCIA_LONGA"
    ]);
    assert.equal(tiposConsultados.has("LIMITE_ULTRAPASSADO"), false);
  } finally {
    mocks.restore();
  }
});
