const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");

const connectMQTT = require("../../../src/services/mqttService");
const { createConnectMQTT, MQTT_TOPIC } = connectMQTT;

const originalEnv = {
  MQTT_URL: process.env.MQTT_URL,
  MQTT_SENSOR_ID: process.env.MQTT_SENSOR_ID
};

function restoreEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function createFakeClient() {
  const handlers = {};
  const subscriptions = [];

  return {
    handlers,
    subscriptions,
    on(event, callback) {
      handlers[event] = callback;
      return this;
    },
    subscribe(topic, callback) {
      subscriptions.push(topic);
      callback?.(this.subscribeError || null);
    }
  };
}

function createLogger() {
  return {
    infos: [],
    errors: [],
    info(message, context) {
      this.infos.push({ message, context });
    },
    error(message, context) {
      this.errors.push({ message, context });
    }
  };
}

afterEach(() => {
  restoreEnv();
});

test("connectMQTT conecta com opcoes esperadas e assina topico ao conectar", () => {
  process.env.MQTT_URL = "mqtt://broker.local";
  const client = createFakeClient();
  const logger = createLogger();
  let connectArgs;

  const mqttModule = {
    connect(url, options) {
      connectArgs = { url, options };
      return client;
    }
  };

  createConnectMQTT({ mqttModule, log: logger })({ get: () => null });
  client.handlers.connect();

  assert.deepEqual(connectArgs, {
    url: "mqtt://broker.local",
    options: {
      keepalive: 60,
      reconnectPeriod: 1000,
      connectTimeout: 30000
    }
  });
  assert.deepEqual(client.subscriptions, [MQTT_TOPIC]);
  assert.equal(logger.infos.some((entry) => entry.message === "mqtt_subscribed"), true);
});

test("message processa leitura valida, usa vibracao_rms e encaminha websocket", async () => {
  const client = createFakeClient();
  const logger = createLogger();
  const emissions = [];
  let leituraPayload;

  const leituraProcessor = {
    async processarNovaLeitura(payload) {
      leituraPayload = payload;
      return { id: 9, ...payload };
    }
  };
  const app = {
    get(key) {
      if (key !== "io") return null;
      return {
        emit(event, payload) {
          emissions.push({ event, payload });
        }
      };
    }
  };

  createConnectMQTT({
    mqttModule: { connect: () => client },
    leituraProcessor,
    log: logger
  })(app);

  await client.handlers.message(MQTT_TOPIC, Buffer.from(JSON.stringify({
    sensorId: 4,
    temperatura: "31.5",
    vibracao_rms: "2.7"
  })));

  assert.deepEqual(leituraPayload, { sensorId: 4, temperatura: 31.5, vibracao: 2.7 });
  assert.deepEqual(emissions, [
    {
      event: "nova-leitura",
      payload: { id: 9, sensorId: 4, temperatura: 31.5, vibracao: 2.7 }
    },
    {
      event: "novaLeitura",
      payload: { id: 9, sensorId: 4, temperatura: 31.5, vibracao: 2.7 }
    }
  ]);
  assert.equal(logger.errors.length, 0);
});

test("message usa sensorId do ambiente e loga payloads invalidos sem propagar erro", async () => {
  process.env.MQTT_SENSOR_ID = "8";
  const client = createFakeClient();
  const logger = createLogger();
  const chamadas = [];

  const leituraProcessor = {
    async processarNovaLeitura(payload) {
      chamadas.push(payload);
      return payload;
    }
  };

  createConnectMQTT({
    mqttModule: { connect: () => client },
    leituraProcessor,
    log: logger
  })({ get: () => null });

  await client.handlers.message(MQTT_TOPIC, Buffer.from(JSON.stringify({
    temperatura: 25,
    vibracao: 1.2
  })));
  await client.handlers.message(MQTT_TOPIC, Buffer.from("{json"));
  await client.handlers.message(MQTT_TOPIC, Buffer.from(JSON.stringify({
    sensorId: "abc",
    temperatura: 25,
    vibracao: 1.2
  })));
  await client.handlers.message(MQTT_TOPIC, Buffer.from(JSON.stringify({
    sensorId: 1,
    temperatura: "x",
    vibracao: 1.2
  })));

  assert.deepEqual(chamadas, [{ sensorId: 8, temperatura: 25, vibracao: 1.2 }]);
  assert.equal(logger.errors.filter((entry) => entry.message === "mqtt_message_processing_error").length, 3);
});

test("connect e error handlers registram falhas de subscribe e conexao", () => {
  const client = createFakeClient();
  const logger = createLogger();
  const subscribeError = new Error("subscribe falhou");
  const connectionError = new Error("broker fora");
  client.subscribeError = subscribeError;

  createConnectMQTT({
    mqttModule: { connect: () => client },
    log: logger
  })({ get: () => null });

  client.handlers.connect();
  client.handlers.error(connectionError);

  assert.deepEqual(logger.errors.map((entry) => entry.message), [
    "mqtt_subscribe_error",
    "mqtt_connection_error"
  ]);
  assert.equal(logger.errors[0].context.error, subscribeError);
  assert.equal(logger.errors[1].context.error, connectionError);
});
