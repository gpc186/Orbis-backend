const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");

const PerfilService = require("../../../src/services/perfilService");
const UsuarioModel = require("../../../src/models/usuarioModel");
const StorageService = require("../../../src/services/storageService");
const OneSignalService = require("../../../src/services/oneSignalService");
const logger = require("../../../src/utils/logger");

const originals = {
  findUsuarioById: UsuarioModel.findById,
  updateUsuario: UsuarioModel.update,
  uploadFoto: StorageService.uploadFoto,
  deleteFoto: StorageService.deleteFoto,
  sendToOneSignalIds: OneSignalService.sendToOneSignalIds,
  loggerError: logger.error,
  dateNow: Date.now
};

afterEach(() => {
  UsuarioModel.findById = originals.findUsuarioById;
  UsuarioModel.update = originals.updateUsuario;
  StorageService.uploadFoto = originals.uploadFoto;
  StorageService.deleteFoto = originals.deleteFoto;
  OneSignalService.sendToOneSignalIds = originals.sendToOneSignalIds;
  logger.error = originals.loggerError;
  Date.now = originals.dateNow;
});

test("findPerfil retorna usuario ou erro 404", async () => {
  UsuarioModel.findById = async (id) => ({ id, nome: "Gustavo" });

  assert.deepEqual(await PerfilService.findPerfil(1), { id: 1, nome: "Gustavo" });

  UsuarioModel.findById = async () => null;
  await assert.rejects(
    () => PerfilService.findPerfil(99),
    (error) => error.name === "AppError" && error.statusCode === 404
  );
});

test("updatePerfil valida dados e atualiza apenas campos enviados", async () => {
  let updateRecebido;
  UsuarioModel.findById = async (id) => ({ id, nome: "Antigo" });
  UsuarioModel.update = async (payload) => {
    updateRecebido = payload;
    return { id: payload.id, ...payload.dados };
  };

  const result = await PerfilService.updatePerfil({
    id: 7,
    dados: {
      nome: "Novo Nome",
      telefone: "(11) 99999-9999",
      especialidade: "Mecanica"
    }
  });

  assert.deepEqual(updateRecebido, {
    id: 7,
    dados: {
      nome: "Novo Nome",
      telefone: "(11) 99999-9999",
      especialidade: "Mecanica"
    }
  });
  assert.deepEqual(result, {
    id: 7,
    nome: "Novo Nome",
    telefone: "(11) 99999-9999",
    especialidade: "Mecanica"
  });
});

test("updatePerfil bloqueia usuario inexistente, campos invalidos e payload vazio", async () => {
  UsuarioModel.findById = async () => null;
  await assert.rejects(
    () => PerfilService.updatePerfil({ id: 1, dados: { nome: "Carlos" } }),
    (error) => error.name === "AppError" && error.statusCode === 404
  );

  UsuarioModel.findById = async (id) => ({ id });

  await assert.rejects(
    () => PerfilService.updatePerfil({ id: 1, dados: { nome: "Al" } }),
    (error) => error.name === "AppError" && error.statusCode === 400
  );
  await assert.rejects(
    () => PerfilService.updatePerfil({ id: 1, dados: { telefone: "abc" } }),
    (error) => error.name === "AppError" && error.statusCode === 400
  );
  await assert.rejects(
    () => PerfilService.updatePerfil({ id: 1, dados: {} }),
    (error) => error.name === "AppError" && error.statusCode === 400
  );
});

test("putOneSignalId valida usuario e salva token trimado", async () => {
  let updateRecebido;
  UsuarioModel.findById = async (id) => ({ id });
  UsuarioModel.update = async (payload) => {
    updateRecebido = payload;
    return { id: payload.id, ...payload.dados };
  };

  const result = await PerfilService.putOneSignalId({ id: 3, oneSignalId: "  player-1  " });

  assert.deepEqual(updateRecebido, { id: 3, dados: { oneSignalId: "player-1" } });
  assert.deepEqual(result, { id: 3, oneSignalId: "player-1" });

  await assert.rejects(
    () => PerfilService.putOneSignalId({ id: 3, oneSignalId: "   " }),
    (error) => error.name === "AppError" && error.statusCode === 400
  );

  UsuarioModel.findById = async () => null;
  await assert.rejects(
    () => PerfilService.putOneSignalId({ id: 999, oneSignalId: "player-1" }),
    (error) => error.name === "AppError" && error.statusCode === 404
  );
});

test("updateFotoPerfil faz upload, atualiza usuario e remove foto antiga", async () => {
  Date.now = () => 1780590000000;
  const chamadasDelete = [];
  let uploadRecebido;
  let updateRecebido;

  UsuarioModel.findById = async (id) => ({ id, caminhoFoto: "perfil/7/antiga.webp" });
  StorageService.uploadFoto = async (payload) => {
    uploadRecebido = payload;
    return {
      url: "https://cdn.example.com/nova.webp",
      caminhoImagem: "perfil/7/perfil-1780590000000.webp"
    };
  };
  UsuarioModel.update = async (payload) => {
    updateRecebido = payload;
    return { id: payload.id, ...payload.dados };
  };
  StorageService.deleteFoto = async (payload) => {
    chamadasDelete.push(payload);
    return { mensagem: "ok" };
  };

  const buffer = Buffer.from("foto");
  const result = await PerfilService.updateFotoPerfil({ usuarioId: 7, buffer });

  assert.deepEqual(uploadRecebido, {
    bucket: "profile-images",
    caminho: "perfil/7/perfil-1780590000000.webp",
    buffer
  });
  assert.deepEqual(updateRecebido, {
    id: 7,
    dados: {
      fotoPerfil: "https://cdn.example.com/nova.webp",
      caminhoFoto: "perfil/7/perfil-1780590000000.webp"
    }
  });
  assert.deepEqual(chamadasDelete, [{ bucket: "profile-images", caminho: "perfil/7/antiga.webp" }]);
  assert.deepEqual(result, {
    id: 7,
    fotoPerfil: "https://cdn.example.com/nova.webp",
    caminhoFoto: "perfil/7/perfil-1780590000000.webp"
  });
});

test("updateFotoPerfil limpa upload novo quando update falha", async () => {
  const erroUpdate = new Error("db falhou");
  const chamadasDelete = [];

  UsuarioModel.findById = async (id) => ({ id });
  StorageService.uploadFoto = async () => ({
    url: "https://cdn.example.com/nova.webp",
    caminhoImagem: "perfil/2/nova.webp"
  });
  UsuarioModel.update = async () => {
    throw erroUpdate;
  };
  StorageService.deleteFoto = async (payload) => {
    chamadasDelete.push(payload);
    return { mensagem: "ok" };
  };

  await assert.rejects(
    () => PerfilService.updateFotoPerfil({ usuarioId: 2, buffer: Buffer.from("foto") }),
    erroUpdate
  );

  assert.deepEqual(chamadasDelete, [{ bucket: "profile-images", caminho: "perfil/2/nova.webp" }]);
});

test("updateFotoPerfil bloqueia usuario inexistente antes do upload", async () => {
  let uploadChamado = false;
  UsuarioModel.findById = async () => null;
  StorageService.uploadFoto = async () => {
    uploadChamado = true;
  };

  await assert.rejects(
    () => PerfilService.updateFotoPerfil({ usuarioId: 404, buffer: Buffer.from("foto") }),
    (error) => error.name === "AppError" && error.statusCode === 404
  );
  assert.equal(uploadChamado, false);
});

test("deleteFotoPerfil limpa campos do usuario e remove foto do storage", async () => {
  const chamadasDelete = [];
  let updateRecebido;

  UsuarioModel.findById = async (id) => ({
    id,
    fotoPerfil: "https://cdn.example.com/antiga.webp",
    caminhoFoto: "perfil/7/antiga.webp"
  });
  UsuarioModel.update = async (payload) => {
    updateRecebido = payload;
    return { id: payload.id, ...payload.dados };
  };
  StorageService.deleteFoto = async (payload) => {
    chamadasDelete.push(payload);
    return { mensagem: "ok" };
  };

  const result = await PerfilService.deleteFotoPerfil({ usuarioId: 7 });

  assert.deepEqual(updateRecebido, {
    id: 7,
    dados: {
      fotoPerfil: null,
      caminhoFoto: null
    }
  });
  assert.deepEqual(chamadasDelete, [{ bucket: "profile-images", caminho: "perfil/7/antiga.webp" }]);
  assert.deepEqual(result, {
    id: 7,
    fotoPerfil: null,
    caminhoFoto: null
  });
});

test("deleteFotoPerfil e idempotente quando usuario nao possui foto", async () => {
  let updateChamado = false;
  let deleteChamado = false;
  const usuario = { id: 3, fotoPerfil: null, caminhoFoto: null };

  UsuarioModel.findById = async () => usuario;
  UsuarioModel.update = async () => {
    updateChamado = true;
  };
  StorageService.deleteFoto = async () => {
    deleteChamado = true;
  };

  const result = await PerfilService.deleteFotoPerfil({ usuarioId: 3 });

  assert.deepEqual(result, usuario);
  assert.equal(updateChamado, false);
  assert.equal(deleteChamado, false);
});

test("deleteFotoPerfil preserva sucesso quando cleanup do storage falha", async () => {
  const erroStorage = new Error("storage indisponivel");
  let logRecebido;

  UsuarioModel.findById = async (id) => ({
    id,
    fotoPerfil: "https://cdn.example.com/antiga.webp",
    caminhoFoto: "perfil/4/antiga.webp"
  });
  UsuarioModel.update = async (payload) => ({ id: payload.id, ...payload.dados });
  StorageService.deleteFoto = async () => {
    throw erroStorage;
  };
  logger.error = (event, payload) => {
    logRecebido = { event, payload };
  };

  const result = await PerfilService.deleteFotoPerfil({ usuarioId: 4 });

  assert.deepEqual(result, {
    id: 4,
    fotoPerfil: null,
    caminhoFoto: null
  });
  assert.equal(logRecebido.event, "perfil_photo_cleanup_failed");
  assert.equal(logRecebido.payload.usuarioId, 4);
  assert.equal(logRecebido.payload.caminhoFoto, "perfil/4/antiga.webp");
  assert.equal(logRecebido.payload.error, erroStorage);
});

test("deleteFotoPerfil bloqueia usuario inexistente", async () => {
  UsuarioModel.findById = async () => null;

  await assert.rejects(
    () => PerfilService.deleteFotoPerfil({ usuarioId: 404 }),
    (error) => error.name === "AppError" && error.statusCode === 404
  );
});

test("sendPushTeste usa oneSignalId cadastrado e bloqueia usuario sem token", async () => {
  let pushRecebido;
  UsuarioModel.findById = async (id) => ({ id, oneSignalId: "player-1" });
  OneSignalService.sendToOneSignalIds = async (payload) => {
    pushRecebido = payload;
    return { sent: 1, failed: 0 };
  };

  const result = await PerfilService.sendPushTeste({
    id: 5,
    title: "Teste",
    message: "Mensagem",
    data: { origem: "teste" }
  });

  assert.deepEqual(pushRecebido, {
    oneSignalIds: ["player-1"],
    title: "Teste",
    message: "Mensagem",
    data: { origem: "teste" }
  });
  assert.deepEqual(result, { sent: 1, failed: 0 });

  UsuarioModel.findById = async () => ({ id: 5, oneSignalId: null });
  await assert.rejects(
    () => PerfilService.sendPushTeste({ id: 5, title: "Teste", message: "Mensagem" }),
    (error) => error.name === "AppError" && error.statusCode === 400
  );

  UsuarioModel.findById = async () => null;
  await assert.rejects(
    () => PerfilService.sendPushTeste({ id: 404, title: "Teste", message: "Mensagem" }),
    (error) => error.name === "AppError" && error.statusCode === 404
  );
});
