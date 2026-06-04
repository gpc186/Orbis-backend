const assert = require("node:assert/strict");
const test = require("node:test");

const AppError = require("../utils/appErrorUtils");
const MaquinaModel = require("../models/maquinaModel");
const SensorModel = require("../models/sensorModel");
const SensorService = require("./sensorService");

test("create falha quando idealTemperatura nao e menor que limiteTemperatura", async () => {
  const originalFindById = MaquinaModel.findById;

  MaquinaModel.findById = async () => ({ id: 1, nome: "Prensa" });

  try {
    await assert.rejects(
      () => SensorService.create({
        maquinaId: 1,
        tipo: "Temperatura",
        limiteTemperatura: 50,
        idealTemperatura: 50,
        limiteVibracao: 12,
        idealVibracao: 4
      }),
      (error) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 400);
        assert.equal(error.message, "idealTemperatura deve ser menor que limiteTemperatura.");
        return true;
      }
    );
  } finally {
    MaquinaModel.findById = originalFindById;
  }
});

test("update falha quando desvioMaximoTemp nao e positivo", async () => {
  const originalFindByIdSensor = SensorModel.findById;
  const originalFindByIdMaquina = MaquinaModel.findById;

  SensorModel.findById = async () => ({
    id: 7,
    maquinaId: 1,
    limiteTemperatura: 90,
    idealTemperatura: 60,
    limiteVibracao: 15,
    idealVibracao: 5,
    desvioMaximoTemp: 6,
    desvioMaximoVibra: 3
  });
  MaquinaModel.findById = async () => ({ id: 1, nome: "Prensa" });

  try {
    await assert.rejects(
      () => SensorService.update(7, {
        maquinaId: 1,
        tipo: "Temperatura",
        status: "ONLINE",
        desvioMaximoTemp: 0
      }),
      (error) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 400);
        assert.equal(error.message, "desvioMaximoTemp deve ser maior que zero.");
        return true;
      }
    );
  } finally {
    SensorModel.findById = originalFindByIdSensor;
    MaquinaModel.findById = originalFindByIdMaquina;
  }
});

test("update reaproveita valores existentes e valida relacao entre ideal e limite", async () => {
  const originalFindByIdSensor = SensorModel.findById;
  const originalFindByIdMaquina = MaquinaModel.findById;
  const originalUpdate = SensorModel.update;
  let capturedArgs = null;

  SensorModel.findById = async () => ({
    id: 7,
    maquinaId: 1,
    limiteTemperatura: 90,
    idealTemperatura: 60,
    limiteVibracao: 15,
    idealVibracao: 5,
    desvioMaximoTemp: 6,
    desvioMaximoVibra: 3
  });
  MaquinaModel.findById = async () => ({ id: 1, nome: "Prensa" });
  SensorModel.update = async (id, dados) => {
    capturedArgs = { id, dados };
    return { id, ...dados };
  };

  try {
    const result = await SensorService.update(7, {
      maquinaId: 1,
      tipo: "Temperatura",
      status: "ONLINE",
      limiteTemperatura: 95
    });

    assert.equal(capturedArgs.dados.idealTemperatura, 60);
    assert.equal(capturedArgs.dados.limiteTemperatura, 95);
    assert.equal(capturedArgs.dados.idealVibracao, 5);
    assert.equal(result.limiteTemperatura, 95);
  } finally {
    SensorModel.findById = originalFindByIdSensor;
    MaquinaModel.findById = originalFindByIdMaquina;
    SensorModel.update = originalUpdate;
  }
});
