const assert = require("node:assert/strict");
const test = require("node:test");

const AppError = require("../../../src/utils/appErrorUtils");
const MaquinaModel = require("../../../src/models/maquinaModel");
const SensorModel = require("../../../src/models/sensorModel");
const SensorService = require("../../../src/services/sensorService");

function patchMethods(target, methods) {
  const originals = {};

  for (const [key, value] of Object.entries(methods)) {
    originals[key] = target[key];
    target[key] = value;
  }

  return () => {
    for (const [key, value] of Object.entries(originals)) {
      target[key] = value;
    }
  };
}

function expectAppError({ statusCode, message }) {
  return (error) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.statusCode, statusCode);
    if (message) assert.equal(error.message, message);
    return true;
  };
}

function sensorFixture(overrides = {}) {
  return {
    id: 7,
    maquinaId: 1,
    tipo: "Temperatura",
    status: "ONLINE",
    limiteTemperatura: 90,
    idealTemperatura: 60,
    limiteVibracao: 15,
    idealVibracao: 5,
    desvioMaximoTemp: 6,
    desvioMaximoVibra: 3,
    ...overrides
  };
}

test("parseNumericField e normalizeSensorPayload validam obrigatorios, numeros e relacoes", () => {
  assert.equal(SensorService.parseNumericField("12.5", "campo"), 12.5);
  assert.equal(SensorService.parseNumericField("", "campo", { required: false }), undefined);

  assert.throws(
    () => SensorService.parseNumericField("", "campo"),
    expectAppError({ statusCode: 400, message: "campo e obrigatorio e deve ser um numero valido." })
  );
  assert.throws(
    () => SensorService.parseNumericField("abc", "campo"),
    expectAppError({ statusCode: 400, message: "campo e obrigatorio e deve ser um numero valido." })
  );
  assert.throws(
    () => SensorService.normalizeSensorPayload({
      limiteTemperatura: 90,
      idealTemperatura: 60,
      limiteVibracao: 5,
      idealVibracao: 5
    }),
    expectAppError({ statusCode: 400, message: "idealVibracao deve ser menor que limiteVibracao." })
  );
  assert.throws(
    () => SensorService.normalizeSensorPayload({
      limiteTemperatura: 90,
      idealTemperatura: 60,
      limiteVibracao: 15,
      idealVibracao: 5,
      desvioMaximoVibra: 0
    }),
    expectAppError({ statusCode: 400, message: "desvioMaximoVibra deve ser maior que zero." })
  );
});

test("create valida maquinaId, existencia da maquina, normaliza dados e trata erro de persistencia", async () => {
  let capturedCreate;
  const restoreMaquina = patchMethods(MaquinaModel, {
    findById: async (id) => (id === 404 ? null : { id, nome: "Prensa" })
  });
  const restoreSensor = patchMethods(SensorModel, {
    create: async (dados) => {
      capturedCreate = dados;
      if (dados.tipo === "Falha") throw new Error("db fora");
      return { id: 11, ...dados };
    }
  });

  try {
    await assert.rejects(
      () => SensorService.create({ maquinaId: "abc" }),
      expectAppError({ statusCode: 400, message: "maquinaId deve ser um numero inteiro valido." })
    );
    await assert.rejects(
      () => SensorService.create({
        maquinaId: 404,
        limiteTemperatura: 80,
        idealTemperatura: 60,
        limiteVibracao: 12,
        idealVibracao: 4
      }),
      expectAppError({ statusCode: 400, message: "Nao e possivel criar o sensor: Maquina selecionada nao existe." })
    );
    await assert.rejects(
      () => SensorService.create({
        maquinaId: 1,
        tipo: "Falha",
        limiteTemperatura: 80,
        idealTemperatura: 60,
        limiteVibracao: 12,
        idealVibracao: 4
      }),
      expectAppError({ statusCode: 500, message: "Erro ao criar sensor." })
    );

    const result = await SensorService.create({
      maquinaId: "1",
      tipo: "Temperatura",
      status: "ONLINE",
      limiteTemperatura: "80",
      idealTemperatura: "60",
      limiteVibracao: "12",
      idealVibracao: "4",
      desvioMaximoTemp: "5",
      desvioMaximoVibra: "2"
    });

    assert.deepEqual(capturedCreate, {
      maquinaId: 1,
      tipo: "Temperatura",
      status: "ONLINE",
      limiteTemperatura: 80,
      idealTemperatura: 60,
      limiteVibracao: 12,
      idealVibracao: 4,
      desvioMaximoTemp: 5,
      desvioMaximoVibra: 2
    });
    assert.equal(result.id, 11);
  } finally {
    restoreSensor();
    restoreMaquina();
  }
});

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

test("list e findById retornam dados e convertem falhas de model em AppError", async () => {
  const restoreSensor = patchMethods(SensorModel, {
    findAll: async () => [{ id: 1 }, { id: 2 }],
    findById: async (id) => {
      if (id === "404") return null;
      if (id === "500") throw new Error("db fora");
      return sensorFixture({ id: Number(id) });
    }
  });

  try {
    assert.deepEqual(await SensorService.list(), [{ id: 1 }, { id: 2 }]);
    assert.equal((await SensorService.findById("7")).id, 7);

    await assert.rejects(
      () => SensorService.findById("404"),
      expectAppError({ statusCode: 404, message: "Sensor nao encontrado." })
    );
    await assert.rejects(
      () => SensorService.findById("500"),
      expectAppError({ statusCode: 500, message: "Erro ao buscar sensor." })
    );
  } finally {
    restoreSensor();
  }

  const restoreListError = patchMethods(SensorModel, {
    findAll: async () => {
      throw new Error("db fora");
    }
  });

  try {
    await assert.rejects(
      () => SensorService.list(),
      expectAppError({ statusCode: 500, message: "Erro ao listar sensores." })
    );
  } finally {
    restoreListError();
  }
});

test("findByTipo valida tipo, clampa limit, repassa filtros e trata erro interno", async () => {
  let capturedArgs;
  const restoreSensor = patchMethods(SensorModel, {
    findByTipo: async (args) => {
      capturedArgs = args;
      if (args.tipo === "falha") throw new Error("db fora");
      return [sensorFixture({ id: 1 }), sensorFixture({ id: 2 })];
    }
  });

  try {
    await assert.rejects(
      () => SensorService.findByTipo({ tipo: "T" }),
      expectAppError({ statusCode: 400, message: "Tipo invalido para busca de sensor." })
    );

    const result = await SensorService.findByTipo({
      tipo: " Temperatura ",
      maquinaId: "4",
      status: "ONLINE",
      limit: 99
    });

    assert.deepEqual(capturedArgs, {
      tipo: "Temperatura",
      maquinaId: "4",
      status: "ONLINE",
      take: 20
    });
    assert.equal(result.total, 2);
    assert.equal(result.dados[0].id, 1);

    await assert.rejects(
      () => SensorService.findByTipo({ tipo: "falha" }),
      expectAppError({ statusCode: 500, message: "Erro ao buscar sensores por tipo." })
    );
  } finally {
    restoreSensor();
  }
});

test("findByMaquinaId valida id, maquina, clampa limit e trata erro de busca", async () => {
  let capturedArgs;
  const restoreMaquina = patchMethods(MaquinaModel, {
    findById: async (id) => {
      if (id === 404) return null;
      return { id, nome: "Prensa" };
    }
  });
  const restoreSensor = patchMethods(SensorModel, {
    findByMaquinaId: async (args) => {
      capturedArgs = args;
      if (args.maquinaId === 500) throw new Error("db fora");
      return [sensorFixture({ id: 3 })];
    }
  });

  try {
    await assert.rejects(
      () => SensorService.findByMaquinaId({ maquinaId: "abc" }),
      expectAppError({ statusCode: 400, message: "Id da maquina invalido para busca de sensores." })
    );
    await assert.rejects(
      () => SensorService.findByMaquinaId({ maquinaId: "404" }),
      expectAppError({ statusCode: 404, message: "Maquina nao encontrada." })
    );
    await assert.rejects(
      () => SensorService.findByMaquinaId({ maquinaId: "500" }),
      expectAppError({ statusCode: 500, message: "Erro ao buscar sensores por maquina." })
    );

    const result = await SensorService.findByMaquinaId({
      maquinaId: "1",
      status: "OFFLINE",
      limit: 0
    });

    assert.deepEqual(capturedArgs, {
      maquinaId: 1,
      status: "OFFLINE",
      take: 10
    });
    assert.deepEqual(result, {
      total: 1,
      dados: [sensorFixture({ id: 3 })]
    });
  } finally {
    restoreSensor();
    restoreMaquina();
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

test("update mantem maquina atual quando maquinaId nao e enviado", async () => {
  let capturedArgs;
  const restoreSensor = patchMethods(SensorModel, {
    findById: async () => sensorFixture(),
    update: async (id, dados) => {
      capturedArgs = { id, dados };
      return { id, ...dados };
    }
  });
  const restoreMaquina = patchMethods(MaquinaModel, {
    findById: async (id) => ({ id, nome: "Prensa" })
  });

  try {
    const result = await SensorService.update(7, {
      tipo: "Temperatura",
      status: "ONLINE",
      limiteTemperatura: 95
    });

    assert.equal(capturedArgs.id, 7);
    assert.equal(capturedArgs.dados.maquinaId, 1);
    assert.equal(capturedArgs.dados.limiteTemperatura, 95);
    assert.equal(capturedArgs.dados.idealTemperatura, 60);
    assert.equal(result.maquinaId, 1);
  } finally {
    restoreMaquina();
    restoreSensor();
  }
});

test("update desconecta maquina quando maquinaId e enviado vazio", async () => {
  let capturedArgs;
  const restoreSensor = patchMethods(SensorModel, {
    findById: async () => sensorFixture(),
    updateDisconnect: async (id, dados) => {
      capturedArgs = { id, dados };
      return { id, ...dados };
    }
  });

  try {
    const result = await SensorService.update(7, {
      maquinaId: "",
      tipo: "Temperatura",
      status: "ONLINE"
    });

    assert.deepEqual(capturedArgs, {
      id: 7,
      dados: {
        maquinaId: "",
        tipo: "Temperatura",
        status: "INATIVO"
      }
    });
    assert.equal(result.status, "INATIVO");
  } finally {
    restoreSensor();
  }
});

test("update valida existencia do sensor, maquina e erro interno de update", async () => {
  const restoreSensor = patchMethods(SensorModel, {
    findById: async (id) => (id === 404 ? null : sensorFixture({ id })),
    update: async () => {
      throw new Error("db fora");
    }
  });
  const restoreMaquina = patchMethods(MaquinaModel, {
    findById: async (id) => (id === 404 ? null : { id, nome: "Prensa" })
  });

  try {
    await assert.rejects(
      () => SensorService.update(404, { maquinaId: 1 }),
      expectAppError({ statusCode: 404, message: "Sensor nao encontrado." })
    );
    await assert.rejects(
      () => SensorService.update(7, { maquinaId: 404 }),
      expectAppError({ statusCode: 400, message: "Maquina selecionada nao existe." })
    );
    await assert.rejects(
      () => SensorService.update(7, {
        maquinaId: 1,
        tipo: "Temperatura",
        limiteTemperatura: 80,
        idealTemperatura: 60,
        limiteVibracao: 12,
        idealVibracao: 4
      }),
      expectAppError({ statusCode: 500, message: "Erro ao atualizar sensor." })
    );
  } finally {
    restoreMaquina();
    restoreSensor();
  }
});

test("delete valida existencia e converte erros de model", async () => {
  const deleted = [];
  const restoreSensor = patchMethods(SensorModel, {
    findById: async (id) => {
      if (id === 404) return null;
      if (id === 500) throw new Error("db fora");
      return sensorFixture({ id });
    },
    delete: async (id) => {
      deleted.push(id);
      return { id };
    }
  });

  try {
    await assert.rejects(
      () => SensorService.delete(404),
      expectAppError({ statusCode: 404, message: "Sensor nao encontrado." })
    );
    await assert.rejects(
      () => SensorService.delete(500),
      expectAppError({ statusCode: 500, message: "Erro ao deletar sensor." })
    );

    assert.deepEqual(await SensorService.delete(7), { id: 7 });
    assert.deepEqual(deleted, [7]);
  } finally {
    restoreSensor();
  }
});

test("countActive e listOfflineRecentes retornam agregados e tratam falhas", async () => {
  const restoreSensor = patchMethods(SensorModel, {
    countActiveSensors: async () => 4,
    listOfflineRecentes: async ({ limit }) => {
      assert.equal(limit, 20);
      return [sensorFixture({ id: 9, status: "OFFLINE" })];
    }
  });

  try {
    assert.equal(await SensorService.countActive(), 4);
    assert.deepEqual(await SensorService.listOfflineRecentes({ limit: 99 }), {
      total: 1,
      dados: [sensorFixture({ id: 9, status: "OFFLINE" })]
    });
  } finally {
    restoreSensor();
  }

  const restoreErrors = patchMethods(SensorModel, {
    countActiveSensors: async () => {
      throw new Error("db fora");
    },
    listOfflineRecentes: async () => {
      throw new Error("db fora");
    }
  });

  try {
    await assert.rejects(
      () => SensorService.countActive(),
      expectAppError({ statusCode: 500, message: "Erro ao contar sensores ativos." })
    );
    await assert.rejects(
      () => SensorService.listOfflineRecentes(),
      expectAppError({ statusCode: 500, message: "Erro ao listar sensores offline." })
    );
  } finally {
    restoreErrors();
  }
});
