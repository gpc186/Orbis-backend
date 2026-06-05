const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");

const AuthController = require("../../../src/controllers/authController");
const UsuarioService = require("../../../src/services/usuarioService");

const originals = {
  login: UsuarioService.login,
  refresh: UsuarioService.refresh,
  logout: UsuarioService.logout,
  logoutAll: UsuarioService.logoutAll
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
  UsuarioService.login = originals.login;
  UsuarioService.refresh = originals.refresh;
  UsuarioService.logout = originals.logout;
  UsuarioService.logoutAll = originals.logoutAll;
});

test("login repassa credenciais ao UsuarioService e responde 200", async () => {
  let payloadRecebido;
  UsuarioService.login = async (payload) => {
    payloadRecebido = payload;
    return { accessToken: "access", refreshToken: "refresh" };
  };

  const req = { body: { email: "admin@example.com", senha: "123456" } };
  const res = createResponse();
  const next = captureNext();

  await AuthController.login(req, res, next);

  assert.deepEqual(payloadRecebido, { email: "admin@example.com", senha: "123456" });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { accessToken: "access", refreshToken: "refresh" });
  assert.deepEqual(next.calls, []);
});

test("refresh e logout repassam token do body", async () => {
  const chamadas = [];
  UsuarioService.refresh = async (token) => {
    chamadas.push(["refresh", token]);
    return { accessToken: "novo-access" };
  };
  UsuarioService.logout = async (token) => {
    chamadas.push(["logout", token]);
    return { message: "logout ok" };
  };

  const refreshRes = createResponse();
  await AuthController.refresh({ body: { token: "refresh-token" } }, refreshRes, captureNext());

  const logoutRes = createResponse();
  await AuthController.logout({ body: { token: "refresh-token" } }, logoutRes, captureNext());

  assert.deepEqual(chamadas, [
    ["refresh", "refresh-token"],
    ["logout", "refresh-token"]
  ]);
  assert.equal(refreshRes.statusCode, 200);
  assert.deepEqual(refreshRes.body, { accessToken: "novo-access" });
  assert.equal(logoutRes.statusCode, 200);
  assert.deepEqual(logoutRes.body, { message: "logout ok" });
});

test("logoutAll usa usuario autenticado", async () => {
  let usuarioIdRecebido;
  UsuarioService.logoutAll = async (id) => {
    usuarioIdRecebido = id;
    return { message: "todos os tokens removidos" };
  };

  const res = createResponse();

  await AuthController.logoutAll({ usuario: { id: 7 } }, res, captureNext());

  assert.equal(usuarioIdRecebido, 7);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { message: "todos os tokens removidos" });
});

test("authController envia erros para next", async () => {
  const error = new Error("login falhou");
  UsuarioService.login = async () => {
    throw error;
  };

  const res = createResponse();
  const next = captureNext();

  await AuthController.login({ body: {} }, res, next);

  assert.deepEqual(next.calls, [error]);
  assert.equal(res.statusCode, null);
});
