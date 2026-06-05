const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");
const { default: axios } = require("axios");

const OneSignalService = require("../../../src/services/oneSignalService");

const originalPost = axios.post;
const originalEnv = {
  ONESIGNAL_APP_ID: process.env.ONESIGNAL_APP_ID,
  ONESIGNAL_API_KEY: process.env.ONESIGNAL_API_KEY,
  ONESIGNAL_API_URL: process.env.ONESIGNAL_API_URL
};

function configureEnv() {
  process.env.ONESIGNAL_APP_ID = "app-1";
  process.env.ONESIGNAL_API_KEY = "key-1";
  process.env.ONESIGNAL_API_URL = "https://onesignal.example.com/notifications";
}

function restoreEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function assertAppError(statusCode) {
  return (error) => error.name === "AppError" && error.statusCode === statusCode;
}

afterEach(() => {
  axios.post = originalPost;
  restoreEnv();
});

test("sendToOneSignalIds envia payload correto e retorna sucesso", async () => {
  configureEnv();
  let postArgs;
  axios.post = async (...args) => {
    postArgs = args;
    return { data: { id: "notification-1" } };
  };

  const result = await OneSignalService.sendToOneSignalIds({
    oneSignalIds: ["player-1", "player-2"],
    title: "Alerta",
    message: "Sensor critico",
    data: { alertaId: 9 }
  });

  assert.deepEqual(result, {
    sent: 2,
    failed: 0,
    providerResponse: { id: "notification-1" }
  });
  assert.deepEqual(postArgs, [
    "https://onesignal.example.com/notifications",
    {
      app_id: "app-1",
      include_subscription_ids: ["player-1", "player-2"],
      headings: { en: "Alerta", pt: "Alerta" },
      contents: { en: "Sensor critico", pt: "Sensor critico" },
      data: { alertaId: 9 }
    },
    {
      headers: {
        Authorization: "Key key-1",
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      timeout: 10000
    }
  ]);
});

test("sendToOneSignalIds retorna falha quando provider nao envia id", async () => {
  configureEnv();
  axios.post = async () => ({ data: { warnings: ["sem id"] } });

  const result = await OneSignalService.sendToOneSignalIds({
    oneSignalIds: ["player-1"],
    title: "Alerta",
    message: "Sensor critico"
  });

  assert.deepEqual(result, {
    sent: 0,
    failed: 1,
    providerResponse: { warnings: ["sem id"] }
  });
});

test("sendToOneSignalIds valida config e payload antes da rede", async () => {
  delete process.env.ONESIGNAL_APP_ID;
  delete process.env.ONESIGNAL_API_KEY;

  await assert.rejects(
    () => OneSignalService.sendToOneSignalIds({ oneSignalIds: ["player"], title: "Alerta", message: "Mensagem" }),
    assertAppError(500)
  );

  configureEnv();
  await assert.rejects(
    () => OneSignalService.sendToOneSignalIds({ oneSignalIds: [], title: "Alerta", message: "Mensagem" }),
    assertAppError(400)
  );
  await assert.rejects(
    () => OneSignalService.sendToOneSignalIds({ oneSignalIds: ["player"], title: "Oi", message: "Mensagem" }),
    assertAppError(400)
  );
  await assert.rejects(
    () => OneSignalService.sendToOneSignalIds({ oneSignalIds: ["player"], title: "Alerta", message: "Oi" }),
    assertAppError(400)
  );
  await assert.rejects(
    () => OneSignalService.sendToOneSignalIds({ oneSignalIds: ["player"], title: "Alerta", message: "Mensagem", data: null }),
    assertAppError(400)
  );
});

test("sendToOneSignalIds mapeia erros HTTP e ausencia de resposta", async () => {
  configureEnv();

  axios.post = async () => {
    const error = new Error("payload invalido");
    error.response = { status: 400, data: { errors: ["invalid"] } };
    throw error;
  };
  await assert.rejects(
    () => OneSignalService.sendToOneSignalIds({ oneSignalIds: ["player"], title: "Alerta", message: "Mensagem" }),
    assertAppError(400)
  );

  axios.post = async () => {
    const error = new Error("auth");
    error.response = { status: 403, data: {} };
    throw error;
  };
  await assert.rejects(
    () => OneSignalService.sendToOneSignalIds({ oneSignalIds: ["player"], title: "Alerta", message: "Mensagem" }),
    assertAppError(502)
  );

  axios.post = async () => {
    const error = new Error("rate");
    error.response = { status: 429, data: {} };
    throw error;
  };
  await assert.rejects(
    () => OneSignalService.sendToOneSignalIds({ oneSignalIds: ["player"], title: "Alerta", message: "Mensagem" }),
    assertAppError(503)
  );

  axios.post = async () => {
    const error = new Error("timeout");
    error.request = {};
    throw error;
  };
  await assert.rejects(
    () => OneSignalService.sendToOneSignalIds({ oneSignalIds: ["player"], title: "Alerta", message: "Mensagem" }),
    assertAppError(504)
  );
});
