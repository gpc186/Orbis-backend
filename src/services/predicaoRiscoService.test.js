const assert = require("node:assert/strict");
const test = require("node:test");

const FeatureEngineeringService = require("./featureEngineeringService");
const PredicaoRiscoService = require("./predicaoRiscoService");

function createContext(overrides = {}) {
  return {
    maquina: {
      id: 1,
      nome: "Maquina teste",
      tipo: "PRENSA",
      criticidade: "ALTA"
    },
    features: {
      integridadeAtual: 74,
      scoreEstabilidadeAtual: 68,
      slopeIntegridade24h: -0.12,
      slopeIntegridade7d: -0.04,
      variacaoIntegridade24h: -8,
      slopeScoreEstabilidade24h: -0.10,
      temperaturaMedia2h: 77,
      temperaturaMedia24h: 72,
      vibracaoMedia2h: 8.7,
      vibracaoMedia24h: 7.6,
      vibracaoMedia7d: 6.2,
      desvioTemperatura24h: 5.4,
      desvioVibracao24h: 1.9,
      proporcaoLeiturasAcimaDoIdeal24h: 0.78,
      proporcaoLeiturasAcimaDoLimite24h: 0.22,
      alertasAtivos: 2,
      alertasUltimas24h: 3,
      alertasUltimas72h: 5,
      instabilidadesUltimas72h: 2,
      tendenciasCurtasUltimas72h: 2,
      tendenciasLongasUltimas7d: 1,
      criticidadePeso: 1,
      tempoDesdeUltimaLeitura: 0.5,
      indiceVariabilidadeTemperatura24h: 0.08,
      indiceVariabilidadeVibracao24h: 0.25,
      razaoVibracao2h24h: 1.18,
      razaoVibracao24h7d: 1.22,
      leituras24h: 14,
      leituras72h: 28,
      leituras7d: 60,
      alertasHistoricosSuficientes: true
    },
    coverage: {
      historicoIntegridadeSuficiente: true,
      leituras24hSuficientes: true,
      leituras72hSuficientes: true,
      leituraRecenteDisponivel: true,
      baseAlertasSuficiente: true
    },
    motivosCobertura: [],
    metadados: {
      pontosHistoricoIntegridade: 30,
      leiturasConsideradas: 60,
      alertasRecentesConsiderados: 5,
      alertasHistoricosConsiderados: 8,
      alertasAtivosConsiderados: 2
    },
    ...overrides
  };
}

function mockFeatureContext(contexto) {
  const originalBuildMachineFeatureSet = FeatureEngineeringService.buildMachineFeatureSet;

  FeatureEngineeringService.buildMachineFeatureSet = async () => contexto;

  return {
    restore() {
      FeatureEngineeringService.buildMachineFeatureSet = originalBuildMachineFeatureSet;
    }
  };
}

test("preverPorMaquina gera risco alto de instabilidade para leituras ruidosas e alertas recentes", async () => {
  const mocks = mockFeatureContext(createContext());

  try {
    const resultado = await PredicaoRiscoService.preverPorMaquina(1);

    assert.equal(resultado.modeloVersao, "v2-node-risk-1");
    assert.equal(resultado.riscos.instabilidade.classificacao, "ALTO");
    assert.equal(resultado.riscos.instabilidade["24h"] >= 0.7, true);
    assert.equal(resultado.riscos.instabilidade["72h"] >= 0.7, true);
    assert.equal(resultado.riscos.instabilidade.motivoAusencia, null);
    assert.equal(resultado.fatoresPrincipais.includes("proporcao_acima_limite_24h"), true);
    assert.equal(resultado.confiancaGeral >= 0.7, true);
  } finally {
    mocks.restore();
  }
});

test("preverPorMaquina gera risco maior de manutencao com queda de integridade e criticidade alta", async () => {
  const mocks = mockFeatureContext(createContext({
    features: {
      ...createContext().features,
      integridadeAtual: 48,
      scoreEstabilidadeAtual: 42,
      slopeIntegridade24h: -0.5,
      slopeIntegridade7d: -0.1,
      variacaoIntegridade24h: -16,
      slopeScoreEstabilidade24h: -0.4,
      criticidadePeso: 1
    }
  }));

  try {
    const resultado = await PredicaoRiscoService.preverPorMaquina(1);

    assert.equal(resultado.riscos.manutencao.classificacao, "ALTO");
    assert.equal(resultado.riscos.manutencao["24h"] >= 0.7, true);
    assert.equal(resultado.riscos.manutencao["72h"] >= resultado.riscos.manutencao["24h"], true);
    assert.equal(resultado.fatoresPrincipais.includes("integridade_atual"), true);
  } finally {
    mocks.restore();
  }
});

test("preverPorMaquina retorna risco baixo para maquina estavel e sem alertas", async () => {
  const mocks = mockFeatureContext(createContext({
    features: {
      ...createContext().features,
      integridadeAtual: 96,
      scoreEstabilidadeAtual: 95,
      slopeIntegridade24h: -0.01,
      slopeIntegridade7d: -0.005,
      variacaoIntegridade24h: -0.4,
      slopeScoreEstabilidade24h: -0.01,
      temperaturaMedia2h: 61,
      temperaturaMedia24h: 60,
      vibracaoMedia2h: 5.1,
      vibracaoMedia24h: 5.0,
      vibracaoMedia7d: 5.0,
      desvioTemperatura24h: 0.3,
      desvioVibracao24h: 0.1,
      proporcaoLeiturasAcimaDoIdeal24h: 0.05,
      proporcaoLeiturasAcimaDoLimite24h: 0,
      alertasAtivos: 0,
      alertasUltimas24h: 0,
      alertasUltimas72h: 1,
      instabilidadesUltimas72h: 0,
      tendenciasCurtasUltimas72h: 0,
      tendenciasLongasUltimas7d: 0,
      criticidadePeso: 0.2,
      indiceVariabilidadeTemperatura24h: 0.01,
      indiceVariabilidadeVibracao24h: 0.02,
      razaoVibracao2h24h: 1.01,
      razaoVibracao24h7d: 1.00,
      alertasHistoricosSuficientes: true
    },
    metadados: {
      pontosHistoricoIntegridade: 30,
      leiturasConsideradas: 120,
      alertasRecentesConsiderados: 1,
      alertasHistoricosConsiderados: 1,
      alertasAtivosConsiderados: 0
    }
  }));

  try {
    const resultado = await PredicaoRiscoService.preverPorMaquina(1);

    assert.equal(resultado.riscos.instabilidade.classificacao, "BAIXO");
    assert.equal(resultado.riscos.alerta.classificacao, "BAIXO");
    assert.equal(resultado.riscos.manutencao.classificacao, "BAIXO");
  } finally {
    mocks.restore();
  }
});

test("preverPorMaquina retorna alguns riscos calculados e outros indisponiveis quando a base e parcial", async () => {
  const contexto = createContext({
    coverage: {
      historicoIntegridadeSuficiente: true,
      leituras24hSuficientes: true,
      leituras72hSuficientes: true,
      leituraRecenteDisponivel: true,
      baseAlertasSuficiente: false
    },
    features: {
      ...createContext().features,
      alertasAtivos: 0,
      alertasUltimas24h: 0,
      alertasUltimas72h: 0,
      instabilidadesUltimas72h: 0,
      tendenciasCurtasUltimas72h: 0,
      tendenciasLongasUltimas7d: 0,
      alertasHistoricosSuficientes: false
    },
    metadados: {
      pontosHistoricoIntegridade: 20,
      leiturasConsideradas: 80,
      alertasRecentesConsiderados: 0,
      alertasHistoricosConsiderados: 0,
      alertasAtivosConsiderados: 0
    }
  });

  const mocks = mockFeatureContext(contexto);

  try {
    const resultado = await PredicaoRiscoService.preverPorMaquina(1);

    assert.equal(resultado.riscos.instabilidade.classificacao != null, true);
    assert.equal(resultado.riscos.manutencao.classificacao != null, true);
    assert.deepEqual(resultado.riscos.alerta, {
      "24h": null,
      "72h": null,
      classificacao: null,
      motivoAusencia: "historico_de_alertas_insuficiente"
    });
  } finally {
    mocks.restore();
  }
});

test("preverPorMaquina retorna motivo de ausencia quando nao ha leitura recente", async () => {
  const contexto = createContext({
    coverage: {
      historicoIntegridadeSuficiente: true,
      leituras24hSuficientes: true,
      leituras72hSuficientes: true,
      leituraRecenteDisponivel: false,
      baseAlertasSuficiente: true
    },
    features: {
      ...createContext().features,
      tempoDesdeUltimaLeitura: 14
    }
  });

  const mocks = mockFeatureContext(contexto);

  try {
    const resultado = await PredicaoRiscoService.preverPorMaquina(1);

    assert.deepEqual(resultado.riscos.instabilidade, {
      "24h": null,
      "72h": null,
      classificacao: null,
      motivoAusencia: "sem_leitura_recente"
    });
    assert.equal(resultado.riscos.alerta.motivoAusencia, "sem_leitura_recente");
    assert.equal(resultado.riscos.manutencao.motivoAusencia, "sem_leitura_recente");
    assert.equal(resultado.confiancaGeral, null);
  } finally {
    mocks.restore();
  }
});
