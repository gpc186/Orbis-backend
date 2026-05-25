const assert = require("node:assert/strict");
const test = require("node:test");

const UsuarioModel = require("../models/usuarioModel");
const UsuarioService = require("./usuarioService");
const AppError = require("../utils/appErrorUtils");

test("findByNome normaliza aliases de role e ignora alias generico de usuario", async () => {
  const originalFindByNome = UsuarioModel.findByNome;
  let capturedArgs = null;

  UsuarioModel.findByNome = async (args) => {
    capturedArgs = args;
    return [];
  };

  try {
    await UsuarioService.findByNome({ nome: "Carlos", role: "usuarios" });
    assert.equal(capturedArgs.role, undefined);

    await UsuarioService.findByNome({ nome: "Carlos", role: "administrador" });
    assert.equal(capturedArgs.role, "ADMIN");

    await UsuarioService.findByNome({ nome: "Carlos", role: "técnico" });
    assert.equal(capturedArgs.role, "TECNICO");
  } finally {
    UsuarioModel.findByNome = originalFindByNome;
  }
});

test("findByNome continua falhando para role realmente invalida", async () => {
  await assert.rejects(
    () => UsuarioService.findByNome({ nome: "Carlos", role: "gerente" }),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 400);
      assert.equal(error.message, "Role invalida para busca de usuario.");
      return true;
    }
  );
});
