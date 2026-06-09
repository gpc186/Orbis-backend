const { afterEach, beforeEach, test } = require("node:test");
const assert = require("node:assert/strict");

const authMiddleware = require("../../../src/middlewares/authMiddleware");
const espMiddleware = require("../../../src/middlewares/espMiddleware");
const roleMiddleware = require("../../../src/middlewares/roleMiddleware");
const UsuarioModel = require("../../../src/models/usuarioModel");
const { generateAccessToken } = require("../../../src/utils/jwtUtils");

const originalFindById = UsuarioModel.findById;
const originalEnv = {
  ESP32_API_KEY: process.env.ESP32_API_KEY,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
  JWT_SECRET: process.env.JWT_SECRET
};

function callMiddleware(middleware, req = {}) {
  return new Promise((resolve) => {
    middleware(req, {}, (error) => resolve(error));
  });
}

beforeEach(() => {
  process.env.ESP32_API_KEY = "esp-ci-key";
  process.env.JWT_EXPIRES_IN = "30m";
  process.env.JWT_SECRET = "jwt-ci-secret";
});

afterEach(() => {
  UsuarioModel.findById = originalFindById;

  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

test("authMiddleware aceita token valido e injeta usuario no request", async () => {
  UsuarioModel.findById = async (id) => ({ id, role: "ADMIN" });

  const token = generateAccessToken({ id: 7, role: "ADMIN" });
  const req = { headers: { authorization: `Bearer ${token}` } };

  const error = await callMiddleware(authMiddleware, req);

  assert.equal(error, undefined);
  assert.deepEqual(req.usuario, { id: 7, role: "ADMIN" });
});

test("authMiddleware permite visitante em leitura e bloqueia escrita", async () => {
  UsuarioModel.findById = async (id) => ({ id, role: "VISITANTE" });

  const token = generateAccessToken({ id: 9, role: "VISITANTE" });
  const getReq = {
    method: "GET",
    originalUrl: "/dashboard/resumo",
    headers: { authorization: `Bearer ${token}` }
  };
  const postReq = {
    method: "POST",
    originalUrl: "/maquinas",
    headers: { authorization: `Bearer ${token}` }
  };

  const getError = await callMiddleware(authMiddleware, getReq);
  const postError = await callMiddleware(authMiddleware, postReq);

  assert.equal(getError, undefined);
  assert.deepEqual(getReq.usuario, { id: 9, role: "VISITANTE" });
  assert.equal(postError.name, "AppError");
  assert.equal(postError.statusCode, 403);
  assert.equal(postError.message, "Perfil visitante possui acesso somente leitura.");
});

test("authMiddleware permite visitante nas excecoes de IA e logout", async () => {
  UsuarioModel.findById = async (id) => ({ id, role: "VISITANTE" });

  const token = generateAccessToken({ id: 9, role: "VISITANTE" });
  const requests = [
    { method: "POST", originalUrl: "/dashboard/ia/perguntar", headers: { authorization: `Bearer ${token}` } },
    { method: "POST", originalUrl: "/relatorios/enviar-agora", headers: { authorization: `Bearer ${token}` } },
    { method: "POST", originalUrl: "/auth/logout", headers: { authorization: `Bearer ${token}` } },
    { method: "DELETE", originalUrl: "/auth/logout-all", headers: { authorization: `Bearer ${token}` } }
  ];

  for (const req of requests) {
    const error = await callMiddleware(authMiddleware, req);
    assert.equal(error, undefined);
    assert.deepEqual(req.usuario, { id: 9, role: "VISITANTE" });
  }
});

test("authMiddleware bloqueia requisicao sem token", async () => {
  const error = await callMiddleware(authMiddleware, { headers: {} });

  assert.equal(error.name, "AppError");
  assert.equal(error.statusCode, 401);
});

test("authMiddleware bloqueia token quando role do banco mudou", async () => {
  UsuarioModel.findById = async (id) => ({ id, role: "TECNICO" });

  const token = generateAccessToken({ id: 7, role: "ADMIN" });
  const req = { headers: { authorization: `Bearer ${token}` } };

  const error = await callMiddleware(authMiddleware, req);

  assert.equal(error.name, "AppError");
  assert.equal(error.statusCode, 401);
});

test("roleMiddleware permite roles autorizadas", async () => {
  const req = { usuario: { role: "TECNICO" } };
  const error = await callMiddleware(roleMiddleware("ADMIN", "TECNICO"), req);

  assert.equal(error, undefined);
});

test("roleMiddleware bloqueia roles nao autorizadas", async () => {
  const req = { usuario: { role: "TECNICO" } };
  const error = await callMiddleware(roleMiddleware("ADMIN"), req);

  assert.equal(error.name, "AppError");
  assert.equal(error.statusCode, 403);
});

test("espMiddleware aceita x-api-key valida", async () => {
  const req = { headers: { "x-api-key": "esp-ci-key" } };
  const error = await callMiddleware(espMiddleware, req);

  assert.equal(error, undefined);
});

test("espMiddleware bloqueia x-api-key ausente ou invalida", async () => {
  const missingKeyError = await callMiddleware(espMiddleware, { headers: {} });
  const invalidKeyError = await callMiddleware(espMiddleware, {
    headers: { "x-api-key": "wrong-key" }
  });

  assert.equal(missingKeyError.name, "AppError");
  assert.equal(missingKeyError.statusCode, 401);
  assert.equal(invalidKeyError.name, "AppError");
  assert.equal(invalidKeyError.statusCode, 401);
});
