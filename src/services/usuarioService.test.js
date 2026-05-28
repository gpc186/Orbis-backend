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

test("updateAtivo atualiza o proprio status ativo quando recebe booleano valido", async () => {
  const originalFindById = UsuarioModel.findById;
  const originalUpdate = UsuarioModel.update;
  let capturedArgs = null;

  UsuarioModel.findById = async (id) => ({
    id,
    nome: "Carlos",
    email: "carlos@teste.com",
    role: "TECNICO",
    ativo: true
  });

  UsuarioModel.update = async (args) => {
    capturedArgs = args;
    return {
      id: args.id,
      ativo: args.dados.ativo
    };
  };

  try {
    const result = await UsuarioService.updateAtivo({ id: 7, ativo: false });

    assert.deepEqual(capturedArgs, {
      id: 7,
      dados: { ativo: false }
    });
    assert.deepEqual(result, {
      id: 7,
      ativo: false
    });
  } finally {
    UsuarioModel.findById = originalFindById;
    UsuarioModel.update = originalUpdate;
  }
});

test("updateAtivo falha quando ativo nao e booleano", async () => {
  const originalFindById = UsuarioModel.findById;

  UsuarioModel.findById = async (id) => ({
    id,
    nome: "Carlos",
    email: "carlos@teste.com",
    role: "TECNICO",
    ativo: true
  });

  try {
    await assert.rejects(
      () => UsuarioService.updateAtivo({ id: 7, ativo: "false" }),
      (error) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 400);
        assert.equal(error.message, "Ativo nao e valido!");
        return true;
      }
    );
  } finally {
    UsuarioModel.findById = originalFindById;
  }
});
