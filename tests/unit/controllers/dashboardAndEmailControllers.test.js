const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");

const DashboardController = require("../../../src/controllers/dashboardController");
const DashboardAiController = require("../../../src/controllers/dashboardAiController");
const EmailController = require("../../../src/controllers/emailController");
const DashboardService = require("../../../src/services/dashboardService");
const DashboardAiService = require("../../../src/services/dashboardAiService");
const ContatoService = require("../../../src/services/contatoService");

const originals = {
  dashboardResume: DashboardService.resume,
  dashboardAiAnswer: DashboardAiService.answer,
  enviarContato: ContatoService.enviarContato
};

function createResponse() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

function captureNext() {
  const calls = [];
  const next = (error) => calls.push(error);
  next.calls = calls;
  return next;
}

afterEach(() => {
  DashboardService.resume = originals.dashboardResume;
  DashboardAiService.answer = originals.dashboardAiAnswer;
  ContatoService.enviarContato = originals.enviarContato;
});

test("DashboardController.resume responde resumo do service", async () => {
  const resumo = {
    totalMaquinas: 10,
    alertasAtivos: 2
  };
  DashboardService.resume = async () => resumo;

  const res = createResponse();
  const next = captureNext();

  await DashboardController.resume({}, res, next);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, resumo);
  assert.deepEqual(next.calls, []);
});

test("DashboardAiController.perguntar repassa pergunta, usuario, historico e confirmacao", async () => {
  let payloadRecebido;
  DashboardAiService.answer = async (payload) => {
    payloadRecebido = payload;
    return { resposta: "panorama", fallback: false };
  };

  const req = {
    usuario: { id: 1, role: "ADMIN" },
    body: {
      pergunta: "Como esta o sistema?",
      historico: [{ role: "user", content: "oi" }],
      confirmationResponse: { confirmationId: "abc", confirmed: true }
    }
  };
  const res = createResponse();

  await DashboardAiController.perguntar(req, res, captureNext());

  assert.deepEqual(payloadRecebido, {
    pergunta: "Como esta o sistema?",
    usuario: { id: 1, role: "ADMIN" },
    historico: [{ role: "user", content: "oi" }],
    confirmationResponse: { confirmationId: "abc", confirmed: true }
  });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { resposta: "panorama", fallback: false });
});

test("EmailController.enviarContato mescla mensagem publica com retorno do service", async () => {
  let payloadRecebido;
  ContatoService.enviarContato = async (payload) => {
    payloadRecebido = payload;
    return {
      enviadoPara: "contato@example.com",
      provider: "resend",
      messageId: "msg-1"
    };
  };

  const req = {
    body: {
      nome: "Gustavo",
      email: "gustavo@example.com",
      assunto: "Duvida",
      mensagem: "Ola"
    }
  };
  const res = createResponse();

  await EmailController.enviarContato(req, res, captureNext());

  assert.deepEqual(payloadRecebido, {
    nome: "Gustavo",
    email: "gustavo@example.com",
    assunto: "Duvida",
    mensagem: "Ola"
  });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    message: "Mensagem enviada com sucesso.",
    enviadoPara: "contato@example.com",
    provider: "resend",
    messageId: "msg-1"
  });
});

test("controllers pequenos encaminham erros para next", async () => {
  const dashboardError = new Error("dashboard falhou");
  DashboardService.resume = async () => {
    throw dashboardError;
  };

  const dashboardRes = createResponse();
  const dashboardNext = captureNext();
  await DashboardController.resume({}, dashboardRes, dashboardNext);

  const aiError = new Error("ia falhou");
  DashboardAiService.answer = async () => {
    throw aiError;
  };

  const aiRes = createResponse();
  const aiNext = captureNext();
  await DashboardAiController.perguntar({ body: {}, usuario: { id: 1 } }, aiRes, aiNext);

  const emailError = new Error("email falhou");
  ContatoService.enviarContato = async () => {
    throw emailError;
  };

  const emailRes = createResponse();
  const emailNext = captureNext();
  await EmailController.enviarContato({ body: {} }, emailRes, emailNext);

  assert.deepEqual(dashboardNext.calls, [dashboardError]);
  assert.deepEqual(aiNext.calls, [aiError]);
  assert.deepEqual(emailNext.calls, [emailError]);
  assert.equal(dashboardRes.statusCode, null);
  assert.equal(aiRes.statusCode, null);
  assert.equal(emailRes.statusCode, null);
});
