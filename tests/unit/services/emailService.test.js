const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");

const EmailService = require("../../../src/services/emailService");

const originals = {
  getClient: EmailService.getClient,
  send: EmailService.send,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL
};

function configureEnv() {
  process.env.RESEND_API_KEY = "resend-key";
  process.env.RESEND_FROM_EMAIL = "Orbis <noreply@example.com>";
}

function restoreEnv() {
  for (const key of ["RESEND_API_KEY", "RESEND_FROM_EMAIL"]) {
    if (originals[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originals[key];
    }
  }
}

function assertAppError(statusCode) {
  return (error) => error.name === "AppError" && error.statusCode === statusCode;
}

afterEach(() => {
  EmailService.getClient = originals.getClient;
  EmailService.send = originals.send;
  restoreEnv();
});

test("getConfig exige chave e remetente do Resend", () => {
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM_EMAIL;

  assert.throws(() => EmailService.getConfig(), assertAppError(500));

  process.env.RESEND_API_KEY = "resend-key";
  assert.throws(() => EmailService.getConfig(), assertAppError(500));

  configureEnv();
  assert.deepEqual(EmailService.getConfig(), {
    apiKey: "resend-key",
    from: "Orbis <noreply@example.com>"
  });
});

test("send valida payload e envia email pelo client configurado", async () => {
  configureEnv();
  let payloadRecebido;
  EmailService.getClient = () => ({
    emails: {
      async send(payload) {
        payloadRecebido = payload;
        return { data: { id: "email-1" } };
      }
    }
  });

  const result = await EmailService.send({
    to: ["ops@example.com"],
    subject: "Alerta Orbis",
    html: "<p>Alerta</p>",
    text: "Alerta",
    replyTo: "gustavo@example.com"
  });

  assert.deepEqual(payloadRecebido, {
    from: "Orbis <noreply@example.com>",
    to: ["ops@example.com"],
    subject: "Alerta Orbis",
    html: "<p>Alerta</p>",
    text: "Alerta",
    reply_to: "gustavo@example.com"
  });
  assert.deepEqual(result, {
    provider: "resend",
    messageId: "email-1"
  });

  await assert.rejects(
    () => EmailService.send({ to: [], subject: "Alerta Orbis", html: "<p>ok</p>" }),
    assertAppError(400)
  );
  await assert.rejects(
    () => EmailService.send({ to: "ops@example.com", subject: "Oi", html: "<p>ok</p>" }),
    assertAppError(400)
  );
  await assert.rejects(
    () => EmailService.send({ to: "ops@example.com", subject: "Alerta Orbis" }),
    assertAppError(400)
  );
});

test("send mapeia erro do provider, ausencia de messageId e erro inesperado", async () => {
  configureEnv();

  EmailService.getClient = () => ({
    emails: {
      async send() {
        return { error: { message: "dominio invalido", statusCode: 422 } };
      }
    }
  });
  await assert.rejects(
    () => EmailService.send({ to: "ops@example.com", subject: "Alerta Orbis", text: "ok" }),
    assertAppError(422)
  );

  EmailService.getClient = () => ({
    emails: {
      async send() {
        return { data: {} };
      }
    }
  });
  await assert.rejects(
    () => EmailService.send({ to: "ops@example.com", subject: "Alerta Orbis", text: "ok" }),
    assertAppError(502)
  );

  EmailService.getClient = () => ({
    emails: {
      async send() {
        throw new Error("rede fora");
      }
    }
  });
  await assert.rejects(
    () => EmailService.send({ to: "ops@example.com", subject: "Alerta Orbis", text: "ok" }),
    assertAppError(502)
  );
});

test("enviarCodigoRedefinicao monta assunto e html do codigo", async () => {
  let payloadRecebido;
  EmailService.send = async (payload) => {
    payloadRecebido = payload;
    return { provider: "resend", messageId: "email-2" };
  };

  const result = await EmailService.enviarCodigoRedefinicao({
    para: "gustavo@example.com",
    nome: "Gustavo",
    code: "123456"
  });

  assert.equal(payloadRecebido.to, "gustavo@example.com");
  assert.equal(payloadRecebido.subject, "Codigo de redefinicao de senha - Orbis");
  assert.match(payloadRecebido.html, /Gustavo/);
  assert.match(payloadRecebido.html, /123456/);
  assert.deepEqual(result, { provider: "resend", messageId: "email-2" });
});
