const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");

const ResetSenhaController = require("../../../src/controllers/resetSenhaController");
const ResetSenhaService = require("../../../src/services/resetSenhaService");

const originals = {
  esqueceuSenha: ResetSenhaService.esqueceuSenha,
  validarCodigo: ResetSenhaService.validarCodigo,
  redefinirSenha: ResetSenhaService.redefinirSenha,
  solicitarAlteracao: ResetSenhaService.solicitarAlteracao,
  confirmarAlteracao: ResetSenhaService.confirmarAlteracao
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
  ResetSenhaService.esqueceuSenha = originals.esqueceuSenha;
  ResetSenhaService.validarCodigo = originals.validarCodigo;
  ResetSenhaService.redefinirSenha = originals.redefinirSenha;
  ResetSenhaService.solicitarAlteracao = originals.solicitarAlteracao;
  ResetSenhaService.confirmarAlteracao = originals.confirmarAlteracao;
});

test("esqueciSenha repassa email e emailDestino ao service", async () => {
  let payloadRecebido;
  ResetSenhaService.esqueceuSenha = async (payload) => {
    payloadRecebido = payload;
    return { message: "ok" };
  };

  const res = createResponse();

  await ResetSenhaController.esqueciSenha({
    body: { email: "user@example.com", emailDestino: "destino@example.com" }
  }, res, captureNext());

  assert.deepEqual(payloadRecebido, {
    email: "user@example.com",
    emailDestino: "destino@example.com"
  });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { message: "ok" });
});

test("validarCodigo e redefinirSenha repassam payload do body", async () => {
  const chamadas = [];
  ResetSenhaService.validarCodigo = async (payload) => {
    chamadas.push(["validar", payload]);
    return { message: "codigo valido" };
  };
  ResetSenhaService.redefinirSenha = async (payload) => {
    chamadas.push(["redefinir", payload]);
    return { message: "senha redefinida" };
  };

  const validarRes = createResponse();
  await ResetSenhaController.validarCodigo({
    body: { email: "user@example.com", code: "123456" }
  }, validarRes, captureNext());

  const redefinirRes = createResponse();
  await ResetSenhaController.redefinirSenha({
    body: { email: "user@example.com", code: "123456", novaSenha: "nova" }
  }, redefinirRes, captureNext());

  assert.deepEqual(chamadas, [
    ["validar", { email: "user@example.com", code: "123456" }],
    ["redefinir", { email: "user@example.com", code: "123456", novaSenha: "nova" }]
  ]);
  assert.equal(validarRes.statusCode, 200);
  assert.deepEqual(validarRes.body, { message: "codigo valido" });
  assert.equal(redefinirRes.statusCode, 200);
  assert.deepEqual(redefinirRes.body, { message: "senha redefinida" });
});

test("solicitarAlteracaoSenha e confirmarAlteracaoSenha usam usuario autenticado", async () => {
  const chamadas = [];
  ResetSenhaService.solicitarAlteracao = async (payload) => {
    chamadas.push(["solicitar", payload]);
    return { message: "codigo enviado" };
  };
  ResetSenhaService.confirmarAlteracao = async (payload) => {
    chamadas.push(["confirmar", payload]);
    return { message: "senha alterada" };
  };

  const solicitarRes = createResponse();
  await ResetSenhaController.solicitarAlteracaoSenha({
    usuario: { id: 9 },
    body: { senhaAtual: "atual", emailDestino: "destino@example.com" }
  }, solicitarRes, captureNext());

  const confirmarRes = createResponse();
  await ResetSenhaController.confirmarAlteracaoSenha({
    usuario: { id: 9 },
    body: { code: "123456", novaSenha: "nova" }
  }, confirmarRes, captureNext());

  assert.deepEqual(chamadas, [
    ["solicitar", { id: 9, senhaAtual: "atual", emailDestino: "destino@example.com" }],
    ["confirmar", { id: 9, code: "123456", novaSenha: "nova" }]
  ]);
  assert.equal(solicitarRes.statusCode, 200);
  assert.deepEqual(solicitarRes.body, { message: "codigo enviado" });
  assert.equal(confirmarRes.statusCode, 200);
  assert.deepEqual(confirmarRes.body, { message: "senha alterada" });
});

test("resetSenhaController envia erros para next", async () => {
  const error = new Error("codigo invalido");
  ResetSenhaService.validarCodigo = async () => {
    throw error;
  };

  const res = createResponse();
  const next = captureNext();

  await ResetSenhaController.validarCodigo({ body: {} }, res, next);

  assert.deepEqual(next.calls, [error]);
  assert.equal(res.statusCode, null);
});
