const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");

const LeituraService = require("../../../src/services/leituraService");
const AlertaService = require("../../../src/services/alertaService");
const PredicaoService = require("../../../src/services/predicaoService");
const leituraModel = require("../../../src/models/leituraModel");
const SensorModel = require("../../../src/models/sensorModel");

const originals = {
  sensorFindById: SensorModel.findById,
  gerarAlerta: AlertaService.gerarAlerta,
  store: leituraModel.store,
  index: leituraModel.index,
  atualizarSaudeMaquina: PredicaoService.atualizarSaudeMaquina,
  previsaoManutencao: PredicaoService.previsaoManutencao
};

afterEach(() => {
  SensorModel.findById = originals.sensorFindById;
  AlertaService.gerarAlerta = originals.gerarAlerta;
  leituraModel.store = originals.store;
  leituraModel.index = originals.index;
  PredicaoService.atualizarSaudeMaquina = originals.atualizarSaudeMaquina;
  PredicaoService.previsaoManutencao = originals.previsaoManutencao;
});

function buildSensor(overrides = {}) {
  return {
    id: 2,
    maquinaId: 5,
    limiteTemperatura: 80,
    idealTemperatura: 40,
    limiteVibracao: 15,
    idealVibracao: 5,
    desvioMaximoTemp: 10,
    desvioMaximoVibra: 3,
    ...overrides
  };
}

test("processarNovaLeitura gera alertas, salva leitura e executa predicao", async () => {
  SensorModel.findById = async () => buildSensor();

  const alertas = [];
  AlertaService.gerarAlerta = async (...args) => {
    alertas.push(args);
  };

  const leituraSalva = { id: 11, sensorId: 2, temperatura: 85, vibracao: 20 };
  leituraModel.store = async (dados) => ({ id: 11, ...dados });

  const predicaoChamadas = [];
  PredicaoService.atualizarSaudeMaquina = async (maquinaId) => {
    predicaoChamadas.push(["saude", maquinaId]);
  };
  PredicaoService.previsaoManutencao = async (maquinaId) => {
    predicaoChamadas.push(["previsao", maquinaId]);
    return {
      estadoPredicao: "MODELO_INVALIDO_COM_RISCO",
      fonteDecisao: "HEURISTICA_CRITICA",
      urgencia: "ALTA",
      motivo: "risco_heuristico"
    };
  };

  const result = await LeituraService.processarNovaLeitura(leituraSalva);

  assert.deepEqual(result, leituraSalva);
  assert.equal(alertas.length, 3);
  assert.deepEqual(alertas.map((alerta) => alerta[2]), [
    "LIMITE_ULTRAPASSADO",
    "LIMITE_ULTRAPASSADO",
    "INSTABILIDADE"
  ]);
  assert.deepEqual(predicaoChamadas, [
    ["saude", 5],
    ["previsao", 5]
  ]);
});

test("processarNovaLeitura nao gera alerta quando leitura esta dentro dos parametros", async () => {
  SensorModel.findById = async () => buildSensor();

  let alertaChamado = false;
  AlertaService.gerarAlerta = async () => {
    alertaChamado = true;
  };
  leituraModel.store = async (dados) => ({ id: 1, ...dados });
  PredicaoService.atualizarSaudeMaquina = async () => {};
  PredicaoService.previsaoManutencao = async () => ({
    fonteDecisao: PredicaoService.FONTES.REGRESSAO_LINEAR
  });

  const result = await LeituraService.processarNovaLeitura({
    sensorId: 2,
    temperatura: 42,
    vibracao: 6
  });

  assert.equal(alertaChamado, false);
  assert.equal(result.id, 1);
});

test("processarNovaLeitura preserva sucesso da leitura quando predicao falha", async () => {
  SensorModel.findById = async () => buildSensor();
  AlertaService.gerarAlerta = async () => {};
  leituraModel.store = async (dados) => ({ id: 21, ...dados });
  PredicaoService.atualizarSaudeMaquina = async () => {
    throw new Error("predicao indisponivel");
  };
  PredicaoService.previsaoManutencao = async () => {
    throw new Error("nao deveria chegar aqui");
  };

  const result = await LeituraService.processarNovaLeitura({
    sensorId: 2,
    temperatura: 42,
    vibracao: 6
  });

  assert.equal(result.id, 21);
});

test("processarNovaLeitura falha com AppError quando sensor nao existe", async () => {
  SensorModel.findById = async () => null;

  await assert.rejects(
    () => LeituraService.processarNovaLeitura({ sensorId: 99, temperatura: 30, vibracao: 3 }),
    (error) => error.name === "AppError" && error.statusCode === 404
  );
});

test("processarNovaLeitura encapsula falhas inesperadas de persistencia", async () => {
  SensorModel.findById = async () => buildSensor();
  AlertaService.gerarAlerta = async () => {};
  leituraModel.store = async () => {
    throw new Error("db fora");
  };

  await assert.rejects(
    () => LeituraService.processarNovaLeitura({ sensorId: 2, temperatura: 42, vibracao: 6 }),
    (error) => error.name === "AppError" && error.statusCode === 500
  );
});

test("index delega limite ao model e encapsula falhas", async () => {
  let limiteRecebido;
  leituraModel.index = async (limite) => {
    limiteRecebido = limite;
    return [{ id: 1 }];
  };

  assert.deepEqual(await LeituraService.index(7), [{ id: 1 }]);
  assert.equal(limiteRecebido, 7);

  leituraModel.index = async () => {
    throw new Error("db fora");
  };

  await assert.rejects(
    () => LeituraService.index(7),
    (error) => error.name === "AppError" && error.statusCode === 500
  );
});
