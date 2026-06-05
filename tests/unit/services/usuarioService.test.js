const assert = require("node:assert/strict");
const test = require("node:test");
const bcrypt = require("bcrypt");

const RefreshTokenModel = require("../../../src/models/refreshTokenModel");
const UsuarioModel = require("../../../src/models/usuarioModel");
const AlertaModel = require("../../../src/models/alertaModel");
const UsuarioService = require("../../../src/services/usuarioService");
const StorageService = require("../../../src/services/storageService");
const AppError = require("../../../src/utils/appErrorUtils");

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

function withAuthEnv() {
  const originalEnv = {
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
    REFRESH_TOKEN_EXPIRES_IN_DAYS: process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS
  };

  process.env.JWT_SECRET = "usuario-service-test-secret";
  process.env.JWT_EXPIRES_IN = "30m";
  process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS = "7";

  return () => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

test("login valida senha, remove senha do usuario e cria refresh token", async () => {
  const restoreEnv = withAuthEnv();
  const restoreUsuario = patchMethods(UsuarioModel, {
    findByEmail: async (email) => ({
      id: 7,
      nome: "Carlos",
      email,
      senha: "hash",
      role: "TECNICO",
      ativo: true
    })
  });
  const restoreRefresh = patchMethods(RefreshTokenModel, {
    create: async ({ usuarioId, token, expiresAt }) => {
      assert.equal(usuarioId, 7);
      assert.equal(typeof token, "string");
      assert.ok(expiresAt instanceof Date);
      return { token: "refresh-token-criado" };
    }
  });
  const restoreBcrypt = patchMethods(bcrypt, {
    compare: async (senha, hash) => {
      assert.equal(senha, "Senha123!");
      assert.equal(hash, "hash");
      return true;
    }
  });

  try {
    const result = await UsuarioService.login({
      email: "carlos@teste.com",
      senha: "Senha123!"
    });

    assert.equal(result.usuarioSemSenha.senha, undefined);
    assert.equal(result.usuarioSemSenha.id, 7);
    assert.equal(typeof result.accessToken, "string");
    assert.equal(result.refreshToken, "refresh-token-criado");
  } finally {
    restoreBcrypt();
    restoreRefresh();
    restoreUsuario();
    restoreEnv();
  }
});

test("login bloqueia usuario inexistente ou senha invalida", async () => {
  const restoreUsuario = patchMethods(UsuarioModel, {
    findByEmail: async () => null
  });

  try {
    await assert.rejects(
      () => UsuarioService.login({ email: "x@teste.com", senha: "Senha123!" }),
      expectAppError({ statusCode: 401, message: "Email ou senha incorretas!" })
    );
  } finally {
    restoreUsuario();
  }

  const restoreUsuarioSenha = patchMethods(UsuarioModel, {
    findByEmail: async () => ({
      id: 1,
      email: "x@teste.com",
      senha: "hash",
      role: "ADMIN"
    })
  });
  const restoreBcrypt = patchMethods(bcrypt, {
    compare: async () => false
  });

  try {
    await assert.rejects(
      () => UsuarioService.login({ email: "x@teste.com", senha: "errada" }),
      expectAppError({ statusCode: 401, message: "Email ou senha incorretos!" })
    );
  } finally {
    restoreBcrypt();
    restoreUsuarioSenha();
  }
});

test("register valida entrada, evita email duplicado, hasheia senha e cria usuario", async () => {
  const restoreUsuario = patchMethods(UsuarioModel, {
    findByEmail: async (email) => {
      if (email === "duplicado@teste.com") return { id: 99 };
      return null;
    },
    create: async (payload) => ({
      id: 10,
      ...payload,
      senha: undefined
    })
  });
  const restoreBcrypt = patchMethods(bcrypt, {
    hash: async (senha, rounds) => {
      assert.equal(senha, "Senha123!");
      assert.equal(rounds, 10);
      return "hash-gerado";
    }
  });

  try {
    await assert.rejects(
      () => UsuarioService.register({ nome: "Ca", email: "novo@teste.com", senha: "Senha123!", role: "TECNICO" }),
      expectAppError({ statusCode: 400, message: "Nome invalido!" })
    );
    await assert.rejects(
      () => UsuarioService.register({ nome: "Carlos", email: "email-invalido", senha: "Senha123!", role: "TECNICO" }),
      expectAppError({ statusCode: 400, message: "Email invalido!" })
    );
    await assert.rejects(
      () => UsuarioService.register({ nome: "Carlos", email: "duplicado@teste.com", senha: "Senha123!", role: "TECNICO" }),
      expectAppError({ statusCode: 400, message: "Credenciais invalidas!" })
    );
    await assert.rejects(
      () => UsuarioService.register({ nome: "Carlos", email: "novo@teste.com", senha: "Senha123!", role: "GERENTE" }),
      expectAppError({ statusCode: 400, message: "Credenciais invalidas!" })
    );
    await assert.rejects(
      () => UsuarioService.register({ nome: "Carlos", email: "novo@teste.com", senha: "fraca", role: "TECNICO" }),
      expectAppError({ statusCode: 400, message: "Senha invalida!" })
    );

    const result = await UsuarioService.register({
      nome: "Carlos",
      email: "novo@teste.com",
      senha: "Senha123!",
      role: "TECNICO"
    });

    assert.deepEqual(result.usuario, {
      id: 10,
      nome: "Carlos",
      email: "novo@teste.com",
      senha: undefined,
      role: "TECNICO"
    });
  } finally {
    restoreBcrypt();
    restoreUsuario();
  }
});

test("refresh valida token, expiracao e usuario antes de gerar access token", async () => {
  const restoreEnv = withAuthEnv();

  const restoreTokenAusente = patchMethods(RefreshTokenModel, {
    findByToken: async () => null
  });
  try {
    await assert.rejects(
      () => UsuarioService.refresh("refresh"),
      expectAppError({ statusCode: 401, message: "Token nao e valido!" })
    );
  } finally {
    restoreTokenAusente();
  }

  const restoreTokenExpirado = patchMethods(RefreshTokenModel, {
    findByToken: async () => ({
      usuarioId: 1,
      expiresAt: new Date(Date.now() - 1000)
    })
  });
  try {
    await assert.rejects(
      () => UsuarioService.refresh("refresh"),
      expectAppError({ statusCode: 401, message: "Token ja expirou!" })
    );
  } finally {
    restoreTokenExpirado();
  }

  const restoreRefresh = patchMethods(RefreshTokenModel, {
    findByToken: async () => ({
      usuarioId: 3,
      expiresAt: new Date(Date.now() + 1000)
    })
  });
  const restoreUsuario = patchMethods(UsuarioModel, {
    findById: async (id) => (id === 3 ? { id, role: "ADMIN" } : null)
  });

  try {
    const result = await UsuarioService.refresh("refresh-valido");
    assert.equal(typeof result.accessToken, "string");
  } finally {
    restoreUsuario();
    restoreRefresh();
    restoreEnv();
  }
});

test("logout remove refresh token valido e logoutAll remove todos do usuario", async () => {
  const deletedTokens = [];
  const logoutAllIds = [];

  const restoreRefresh = patchMethods(RefreshTokenModel, {
    findByToken: async (token) => ({ token, usuarioId: 4 }),
    delete: async (token) => deletedTokens.push(token),
    logoutAll: async (id) => logoutAllIds.push(id)
  });
  const restoreUsuario = patchMethods(UsuarioModel, {
    findById: async (id) => ({ id, role: "TECNICO" })
  });

  try {
    assert.deepEqual(await UsuarioService.logout("refresh"), {
      mensagem: "Token deletado com sucesso!"
    });
    assert.deepEqual(await UsuarioService.logoutAll(4), {
      mensagem: "usuario deslogado com sucesso!"
    });
    assert.deepEqual(deletedTokens, ["refresh"]);
    assert.deepEqual(logoutAllIds, [4]);
  } finally {
    restoreUsuario();
    restoreRefresh();
  }
});

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

test("list e listAllTecnicos calculam paginacao e delegam skip/take corretos", async () => {
  const chamadas = [];
  const restoreUsuario = patchMethods(UsuarioModel, {
    findAll: async (args) => {
      chamadas.push(["findAll", args]);
      return [{ id: 1 }];
    },
    count: async () => 11,
    findAllTecnicos: async (args) => {
      chamadas.push(["findAllTecnicos", args]);
      return [{ id: 2, role: "TECNICO" }];
    },
    countTecnicos: async () => 6
  });

  try {
    assert.deepEqual(await UsuarioService.list({ page: "2", limit: "5" }), {
      dados: [{ id: 1 }],
      total: 11,
      page: 2,
      totalPages: 3
    });
    assert.deepEqual(await UsuarioService.listAllTecnicos({ page: "3", limit: "2" }), {
      dados: [{ id: 2, role: "TECNICO" }],
      total: 6,
      page: 3,
      totalPages: 3
    });
    assert.deepEqual(chamadas, [
      ["findAll", { skip: 5, take: 5 }],
      ["findAllTecnicos", { skip: 4, take: 2 }]
    ]);
  } finally {
    restoreUsuario();
  }
});

test("findTecnicosByNome valida nome, clampa limit e adiciona alertaEmAndamento", async () => {
  const restoreUsuario = patchMethods(UsuarioModel, {
    findTecnicosByNome: async (args) => {
      assert.deepEqual(args, {
        nome: "Ana",
        take: 20,
        ativo: true
      });
      return [
        { id: 1, nome: "Ana Maria" },
        { id: 2, nome: "Ana Clara" }
      ];
    }
  });
  const restoreAlerta = patchMethods(AlertaModel, {
    findAlertaStatusOfTecnicoById: async (id) => (id === 1 ? { id: 99 } : null)
  });

  try {
    await assert.rejects(
      () => UsuarioService.findTecnicosByNome({ nome: "A" }),
      expectAppError({ statusCode: 400, message: "Nome invalido para busca de tecnico." })
    );

    const result = await UsuarioService.findTecnicosByNome({
      nome: " Ana ",
      limit: 50,
      somenteAtivos: true
    });

    assert.deepEqual(result, {
      total: 2,
      dados: [
        { id: 1, nome: "Ana Maria", alertaEmAndamento: true },
        { id: 2, nome: "Ana Clara", alertaEmAndamento: false }
      ]
    });
  } finally {
    restoreAlerta();
    restoreUsuario();
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

test("findAlertasByTecnicoId valida paginacao, existencia, role e retorna alertas paginados", async () => {
  const restoreUsuario = patchMethods(UsuarioModel, {
    findById: async (id) => {
      if (id === 404) return null;
      if (id === 8) return { id, role: "ADMIN" };
      return { id, role: "TECNICO" };
    }
  });
  const restoreAlerta = patchMethods(AlertaModel, {
    findAlertasByTecnico: async (tecnicoId, args) => {
      assert.equal(tecnicoId, 7);
      assert.deepEqual(args, { skip: 10, take: 10 });
      return [{ id: 1, tecnicoId }];
    },
    countAlertasByTecnicoId: async (tecnicoId) => {
      assert.equal(tecnicoId, 7);
      return 21;
    }
  });

  try {
    await assert.rejects(
      () => UsuarioService.findAlertasByTecnicoId(7, { page: "1" }),
      expectAppError({ statusCode: 400, message: "Paginacao nao usada corretamente!" })
    );
    await assert.rejects(
      () => UsuarioService.findAlertasByTecnicoId(404, { page: "1", limit: "10" }),
      expectAppError({ statusCode: 404, message: "Tecnico nao encontrado!" })
    );
    await assert.rejects(
      () => UsuarioService.findAlertasByTecnicoId(8, { page: "1", limit: "10" }),
      expectAppError({ statusCode: 403, message: "Usuario nao e tecnico!" })
    );

    assert.deepEqual(await UsuarioService.findAlertasByTecnicoId(7, { page: "2", limit: "10" }), {
      dados: [{ id: 1, tecnicoId: 7 }],
      total: 21,
      page: 2,
      totalPages: 3
    });
  } finally {
    restoreAlerta();
    restoreUsuario();
  }
});

test("findById, findTecnicoById e countActiveTecnicos preservam erros e status calculado", async () => {
  const restoreUsuario = patchMethods(UsuarioModel, {
    findById: async (id) => {
      if (id === 404) return null;
      if (id === 9) return { id, role: "ADMIN" };
      return { id, nome: "Tecnico", role: "TECNICO" };
    },
    countActiveTecnico: async () => 5
  });
  const restoreAlerta = patchMethods(AlertaModel, {
    findAlertaStatusOfTecnicoById: async (id) => (id === 7 ? { id: 1 } : null)
  });

  try {
    assert.deepEqual(await UsuarioService.findById(7), {
      id: 7,
      nome: "Tecnico",
      role: "TECNICO"
    });
    await assert.rejects(
      () => UsuarioService.findById(404),
      expectAppError({ statusCode: 404, message: "Usuario nao encontrado!" })
    );
    await assert.rejects(
      () => UsuarioService.findTecnicoById(404),
      expectAppError({ statusCode: 404, message: "Tecnico nao encontrado!" })
    );
    await assert.rejects(
      () => UsuarioService.findTecnicoById(9),
      expectAppError({ statusCode: 403, message: "Usuario nao e tecnico!" })
    );
    assert.deepEqual(await UsuarioService.findTecnicoById(7), {
      id: 7,
      nome: "Tecnico",
      role: "TECNICO",
      alertaEmAndamento: true
    });
    assert.equal(await UsuarioService.countActiveTecnicos(), 5);
  } finally {
    restoreAlerta();
    restoreUsuario();
  }
});

test("update valida campos, protege ultimo admin e atualiza somente dados enviados", async () => {
  const updates = [];
  const restoreUsuario = patchMethods(UsuarioModel, {
    findById: async (id) => {
      if (id === 404) return null;
      if (id === 1) return { id, role: "ADMIN" };
      return { id, role: "TECNICO" };
    },
    countAdmins: async () => 1,
    update: async (args) => {
      updates.push(args);
      return { id: args.id, ...args.dados };
    }
  });

  try {
    await assert.rejects(
      () => UsuarioService.update({ id: 404, dados: { nome: "Carlos" } }),
      expectAppError({ statusCode: 404, message: "Usuario nao encontrado!" })
    );
    await assert.rejects(
      () => UsuarioService.update({ id: 1, dados: { role: "TECNICO" } }),
      expectAppError({ statusCode: 409, message: "Nao e possivel rebaixar o ultimo admin!" })
    );
    await assert.rejects(
      () => UsuarioService.update({ id: 2, dados: { nome: "Ca" } }),
      expectAppError({ statusCode: 400, message: "Nome invalido!" })
    );
    await assert.rejects(
      () => UsuarioService.update({ id: 2, dados: { especialidade: "A" } }),
      expectAppError({ statusCode: 400, message: "Especialidade invalida!" })
    );
    await assert.rejects(
      () => UsuarioService.update({ id: 2, dados: { telefone: "abc" } }),
      expectAppError({ statusCode: 400, message: "Telefone invalido!" })
    );
    await assert.rejects(
      () => UsuarioService.update({ id: 2, dados: { role: "GERENTE" } }),
      expectAppError({ statusCode: 400, message: "Role invalido!" })
    );
    await assert.rejects(
      () => UsuarioService.update({ id: 2, dados: { ativo: "true" } }),
      expectAppError({ statusCode: 400, message: "Ativo nao e valido!" })
    );
    await assert.rejects(
      () => UsuarioService.update({ id: 2, dados: {} }),
      expectAppError({ statusCode: 400, message: "Nenhum campo valido para atualizar!" })
    );

    assert.deepEqual(await UsuarioService.update({
      id: 2,
      dados: {
        nome: "Carlos Silva",
        especialidade: "Eletrica",
        telefone: "(11) 99999-9999",
        ativo: false
      }
    }), {
      id: 2,
      nome: "Carlos Silva",
      especialidade: "Eletrica",
      telefone: "(11) 99999-9999",
      ativo: false
    });
    assert.deepEqual(updates, [{
      id: 2,
      dados: {
        nome: "Carlos Silva",
        especialidade: "Eletrica",
        telefone: "(11) 99999-9999",
        ativo: false
      }
    }]);
  } finally {
    restoreUsuario();
  }
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

test("delete bloqueia usuario inexistente/admin e remove foto de tecnico sem falhar no cleanup", async () => {
  const deletedUsers = [];
  const cleanupCalls = [];
  const restoreUsuario = patchMethods(UsuarioModel, {
    findById: async (id) => {
      if (id === 404) return null;
      if (id === 1) return { id, role: "ADMIN" };
      return {
        id,
        role: "TECNICO",
        caminhoFoto: id === 2 ? "usuarios/2.webp" : null
      };
    },
    delete: async (id) => deletedUsers.push(id)
  });
  const restoreStorage = patchMethods(StorageService, {
    deleteFoto: async (args) => {
      cleanupCalls.push(args);
      throw new Error("storage fora");
    }
  });

  try {
    await assert.rejects(
      () => UsuarioService.delete(404),
      expectAppError({ statusCode: 404, message: "Usuario nao encontrado!" })
    );
    await assert.rejects(
      () => UsuarioService.delete(1),
      expectAppError({ statusCode: 409, message: "Voce nao pode deletar outro admin!" })
    );

    assert.deepEqual(await UsuarioService.delete(2), {
      mensagem: "Usuario deletado com sucesso!"
    });
    assert.deepEqual(deletedUsers, [2]);
    assert.deepEqual(cleanupCalls, [{
      bucket: "profile-images",
      caminho: "usuarios/2.webp"
    }]);
  } finally {
    restoreStorage();
    restoreUsuario();
  }
});
