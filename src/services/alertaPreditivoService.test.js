const assert = require("node:assert/strict");
const test = require("node:test");

const AlertaModel = require("../models/alertaModel");
const HistoricoIntegridadeModel = require("../models/historicoIntegridadeModel");
const PredicaoService = require("./predicaoService");
const AlertaPreditivoService = require("./alertaPreditivoService");

function createModelResult({
  r2 = 0.84,
  slope = -1,
  intercept = 100,
  dataBase = "2026-05-21T00:00:00.000Z",
  referenceTime = "2026-05-21T06:00:00.000Z",
  points = 30,
  computeX,
  valido = true,
  motivo = null,
  janelaHorasCoberta = 30,
  ultimoPontoEm = "2026-05-21T06:00:00.000Z"
} = {}) {
  return {
    disponivel: true,
    valido,
    motivo,
    modeloIntegridade: {
      modelo: {
        computeX: computeX || ((limiar) => 100 - limiar)
      },
      score: { r2 },
      slope,
      intercept,
      dataBase: new Date(dataBase),
      referenciaTemporal: new Date(referenceTime),
      pontosUsados: points,
      janelaHorasCoberta,
      ultimoPontoEm: new Date(ultimoPontoEm)
    }
  };
}

function createAlert(id, maquinaId, tipo, criadoEm) {
  return { id, maquinaId, tipo, criadoEm };
}

function mockServiceDependencies({
  diagnostico = null,
  machineAlerts = {},
  typeAlerts = {},
  globalAlerts = {},
  historicoPorAlerta = {}
} = {}) {
  const originalDiagnosticarPredicao = PredicaoService.diagnosticarPredicao;
  const originalFindByMaquinaAndTipos = AlertaModel.findByMaquinaAndTipos;
  const originalFindByTipoMaquinaAndTipos = AlertaModel.findByTipoMaquinaAndTipos;
  const originalFindByTipos = AlertaModel.findByTipos;
  const originalFindLatestBefore = HistoricoIntegridadeModel.findLatestBefore;

  const chamadasTipos = [];

  PredicaoService.diagnosticarPredicao = async () => diagnostico;
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
    const integridade = historicoPorAlerta[String(dataReferencia)];

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
      PredicaoService.diagnosticarPredicao = originalDiagnosticarPredicao;
      AlertaModel.findByMaquinaAndTipos = originalFindByMaquinaAndTipos;
      AlertaModel.findByTipoMaquinaAndTipos = originalFindByTipoMaquinaAndTipos;
      AlertaModel.findByTipos = originalFindByTipos;
      HistoricoIntegridadeModel.findLatestBefore = originalFindLatestBefore;
    }
  };
}

test("preverPorMaquina retorna estado explicito quando a maquina ja exige manutencao imediata", async () => {
  const mocks = mockServiceDependencies({
    diagnostico: {
      maquina: { id: 1, tipo: "CNC", nome: "Maquina teste" },
      avaliacaoModelo: createModelResult({
        valido: false,
        motivo: PredicaoService.MOTIVOS.TENDENCIA_NAO_CONFIAVEL
      }),
      estadoPredicao: PredicaoService.ESTADOS.MANUTENCAO_IMEDIATA,
      fonteDecisao: PredicaoService.FONTES.HEURISTICA_CRITICA,
      urgencia: PredicaoService.URGENCIAS.IMEDIATA,
      motivo: PredicaoService.MOTIVOS.LIMIAR_MANUTENCAO_JA_CRUZADO
    }
  });

  try {
    const resultado = await AlertaPreditivoService.preverPorMaquina(1);

    assert.equal(resultado.estadoPredicao, "MANUTENCAO_IMEDIATA");
    assert.equal(resultado.fonteDecisao, "HEURISTICA_CRITICA");
    assert.equal(resultado.urgencia, "IMEDIATA");
    assert.equal(resultado.motivo, "limiar_manutencao_ja_cruzado");
    assert.equal(resultado.proximoAlerta, null);
    assert.deepEqual(resultado.ausenciaProximoAlerta, {
      motivo: "limiar_manutencao_ja_cruzado"
    });
  } finally {
    mocks.restore();
  }
});

test("preverPorMaquina retorna fallback explicito quando o modelo invalido ainda indica criticidade", async () => {
  const mocks = mockServiceDependencies({
    diagnostico: {
      maquina: { id: 1, tipo: "CNC", nome: "Maquina teste" },
      avaliacaoModelo: createModelResult({
        valido: false,
        motivo: PredicaoService.MOTIVOS.TENDENCIA_NAO_CONFIAVEL
      }),
      estadoPredicao: PredicaoService.ESTADOS.MODELO_INVALIDO_COM_RISCO,
      fonteDecisao: PredicaoService.FONTES.HEURISTICA_CRITICA,
      urgencia: PredicaoService.URGENCIAS.ALTA,
      motivo: PredicaoService.MOTIVOS.RISCO_HEURISTICO_CRITICO
    }
  });

  try {
    const resultado = await AlertaPreditivoService.preverPorMaquina(1);

    assert.equal(resultado.estadoPredicao, "MODELO_INVALIDO_COM_RISCO");
    assert.equal(resultado.motivo, "risco_heuristico_critico");
    assert.equal(resultado.instabilidade, null);
    assert.deepEqual(resultado.ausenciaInstabilidade, {
      motivo: "risco_heuristico_critico"
    });
  } finally {
    mocks.restore();
  }
});

test("preverPorMaquina usa o limiar da propria maquina quando ha amostras suficientes e a previsao linear e valida", async () => {
  const alertaA = createAlert(1, 1, "INSTABILIDADE", "2026-05-20T01:00:00.000Z");
  const alertaB = createAlert(2, 1, "INSTABILIDADE", "2026-05-20T02:00:00.000Z");
  const alertaC = createAlert(3, 1, "INSTABILIDADE", "2026-05-20T03:00:00.000Z");

  const mocks = mockServiceDependencies({
    diagnostico: {
      maquina: { id: 1, tipo: "CNC", nome: "Maquina teste" },
      avaliacaoModelo: createModelResult(),
      estadoPredicao: PredicaoService.ESTADOS.PREVISAO_VALIDA,
      fonteDecisao: PredicaoService.FONTES.REGRESSAO_LINEAR,
      urgencia: PredicaoService.URGENCIAS.ALTA,
      motivo: PredicaoService.MOTIVOS.PREVISAO_LINEAR_VALIDA
    },
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

    assert.equal(resultado.estadoPredicao, "PREVISAO_VALIDA");
    assert.equal(resultado.proximoAlerta.tipo, "INSTABILIDADE");
    assert.equal(resultado.proximoAlerta.fonteLimiar, "MAQUINA");
    assert.equal(resultado.proximoAlerta.integridadeLimiar, 72);
    assert.equal(resultado.modeloIntegridade.janelaHorasCoberta, 30);
    assert.equal(resultado.modeloIntegridade.ultimoPontoEm.toISOString(), "2026-05-21T06:00:00.000Z");
  } finally {
    mocks.restore();
  }
});

test("preverPorMaquina faz fallback para tipo da maquina e escolhe o menor candidato como proximo alerta", async () => {
  const inst1 = createAlert(1, 2, "INSTABILIDADE", "2026-05-20T01:00:00.000Z");
  const inst2 = createAlert(2, 3, "INSTABILIDADE", "2026-05-20T02:00:00.000Z");
  const inst3 = createAlert(3, 4, "INSTABILIDADE", "2026-05-20T03:00:00.000Z");

  const tend1 = createAlert(4, 2, "TENDENCIA_CURTA", "2026-05-20T04:00:00.000Z");
  const tend2 = createAlert(5, 3, "TENDENCIA_CURTA", "2026-05-20T05:00:00.000Z");
  const tend3 = createAlert(6, 4, "TENDENCIA_CURTA", "2026-05-20T06:00:00.000Z");

  const mocks = mockServiceDependencies({
    diagnostico: {
      maquina: { id: 1, tipo: "CNC", nome: "Maquina teste" },
      avaliacaoModelo: createModelResult({
        computeX: (limiar) => {
          if (limiar === 75) return 8;
          if (limiar === 85) return 7;
          return 20;
        }
      }),
      estadoPredicao: PredicaoService.ESTADOS.PREVISAO_VALIDA,
      fonteDecisao: PredicaoService.FONTES.REGRESSAO_LINEAR,
      urgencia: PredicaoService.URGENCIAS.ALTA,
      motivo: PredicaoService.MOTIVOS.PREVISAO_LINEAR_VALIDA
    },
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
    assert.equal(resultado.instabilidade.dataPrevista.toISOString(), "2026-05-21T08:00:00.000Z");
  } finally {
    mocks.restore();
  }
});

test("preverPorMaquina consulta apenas os tipos suportados e exclui LIMITE_ULTRAPASSADO", async () => {
  const mocks = mockServiceDependencies({
    diagnostico: {
      maquina: { id: 1, tipo: "CNC", nome: "Maquina teste" },
      avaliacaoModelo: createModelResult(),
      estadoPredicao: PredicaoService.ESTADOS.PREVISAO_VALIDA,
      fonteDecisao: PredicaoService.FONTES.REGRESSAO_LINEAR,
      urgencia: PredicaoService.URGENCIAS.MEDIA,
      motivo: PredicaoService.MOTIVOS.PREVISAO_LINEAR_VALIDA
    }
  });

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
