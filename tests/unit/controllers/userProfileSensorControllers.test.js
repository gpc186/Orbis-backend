const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");

const UsuarioController = require("../../../src/controllers/usuarioController");
const TecnicoController = require("../../../src/controllers/tecnicoController");
const { PerfilController } = require("../../../src/controllers/perfilController");
const SensorController = require("../../../src/controllers/sensorController");
const UsuarioService = require("../../../src/services/usuarioService");
const PerfilService = require("../../../src/services/perfilService");
const SensorService = require("../../../src/services/sensorService");

const originals = {
  listUsuarios: UsuarioService.list,
  findUsuarioById: UsuarioService.findById,
  updateUsuario: UsuarioService.update,
  updateAtivo: UsuarioService.updateAtivo,
  register: UsuarioService.register,
  deleteUsuario: UsuarioService.delete,
  listAllTecnicos: UsuarioService.listAllTecnicos,
  findTecnicoById: UsuarioService.findTecnicoById,
  findAlertasByTecnicoId: UsuarioService.findAlertasByTecnicoId,
  findPerfil: PerfilService.findPerfil,
  updatePerfil: PerfilService.updatePerfil,
  putOneSignalId: PerfilService.putOneSignalId,
  updateFotoPerfil: PerfilService.updateFotoPerfil,
  deleteFotoPerfil: PerfilService.deleteFotoPerfil,
  sendPushTeste: PerfilService.sendPushTeste,
  createSensor: SensorService.create,
  listSensores: SensorService.list,
  deleteSensor: SensorService.delete,
  updateSensor: SensorService.update,
  findSensorById: SensorService.findById
};

function createResponse() {
  return {
    statusCode: null,
    body: null,
    sent: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    send(body) {
      this.body = body;
      this.sent = true;
      return this;
    }
  };
}

function normalizeMessage(message) {
  return message.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function captureNext() {
  const calls = [];
  const next = (error) => calls.push(error);
  next.calls = calls;
  return next;
}

afterEach(() => {
  UsuarioService.list = originals.listUsuarios;
  UsuarioService.findById = originals.findUsuarioById;
  UsuarioService.update = originals.updateUsuario;
  UsuarioService.updateAtivo = originals.updateAtivo;
  UsuarioService.register = originals.register;
  UsuarioService.delete = originals.deleteUsuario;
  UsuarioService.listAllTecnicos = originals.listAllTecnicos;
  UsuarioService.findTecnicoById = originals.findTecnicoById;
  UsuarioService.findAlertasByTecnicoId = originals.findAlertasByTecnicoId;
  PerfilService.findPerfil = originals.findPerfil;
  PerfilService.updatePerfil = originals.updatePerfil;
  PerfilService.putOneSignalId = originals.putOneSignalId;
  PerfilService.updateFotoPerfil = originals.updateFotoPerfil;
  PerfilService.deleteFotoPerfil = originals.deleteFotoPerfil;
  PerfilService.sendPushTeste = originals.sendPushTeste;
  SensorService.create = originals.createSensor;
  SensorService.list = originals.listSensores;
  SensorService.delete = originals.deleteSensor;
  SensorService.update = originals.updateSensor;
  SensorService.findById = originals.findSensorById;
});

test("UsuarioController repassa query, params, body e usuario autenticado", async () => {
  const chamadas = [];
  UsuarioService.list = async (payload) => {
    chamadas.push(["list", payload]);
    return { dados: [] };
  };
  UsuarioService.findById = async (id) => {
    chamadas.push(["findById", id]);
    return { id: Number(id) };
  };
  UsuarioService.update = async (payload) => {
    chamadas.push(["update", payload]);
    return { id: Number(payload.id), ...payload.dados };
  };
  UsuarioService.updateAtivo = async (payload) => {
    chamadas.push(["updateAtivo", payload]);
    return { id: payload.id, ativo: payload.ativo };
  };
  UsuarioService.register = async (payload) => {
    chamadas.push(["register", payload]);
    return { id: 1, email: payload.email };
  };
  UsuarioService.delete = async (id) => {
    chamadas.push(["delete", id]);
    return { message: "removido" };
  };

  const listRes = createResponse();
  await UsuarioController.list({ query: { page: "2", limit: "10" } }, listRes, captureNext());

  const findRes = createResponse();
  await UsuarioController.findById({ params: { id: "7" } }, findRes, captureNext());

  const updateRes = createResponse();
  await UsuarioController.update({ params: { id: "7" }, body: { nome: "Novo" } }, updateRes, captureNext());

  const ativoRes = createResponse();
  await UsuarioController.updateAtivo({ usuario: { id: 7 }, body: { ativo: false } }, ativoRes, captureNext());

  const registerRes = createResponse();
  await UsuarioController.register({
    body: { nome: "Admin", email: "admin@example.com", senha: "123456", role: "ADMIN" }
  }, registerRes, captureNext());

  const deleteRes = createResponse();
  await UsuarioController.delete({ params: { id: "7" } }, deleteRes, captureNext());

  assert.deepEqual(chamadas, [
    ["list", { page: "2", limit: "10" }],
    ["findById", "7"],
    ["update", { id: "7", dados: { nome: "Novo" } }],
    ["updateAtivo", { id: 7, ativo: false }],
    ["register", { nome: "Admin", email: "admin@example.com", senha: "123456", role: "ADMIN" }],
    ["delete", "7"]
  ]);
  assert.deepEqual(listRes.body, { dados: [] });
  assert.deepEqual(findRes.body, { id: 7 });
  assert.deepEqual(updateRes.body, { id: 7, nome: "Novo" });
  assert.deepEqual(ativoRes.body, { id: 7, ativo: false });
  assert.equal(registerRes.statusCode, 201);
  assert.deepEqual(deleteRes.body, { message: "removido" });
});

test("TecnicoController repassa paginacao, params e busca de alertas", async () => {
  const chamadas = [];
  UsuarioService.listAllTecnicos = async (payload) => {
    chamadas.push(["listAllTecnicos", payload]);
    return { dados: [] };
  };
  UsuarioService.findTecnicoById = async (id) => {
    chamadas.push(["findTecnicoById", id]);
    return { id: Number(id), role: "TECNICO" };
  };
  UsuarioService.findAlertasByTecnicoId = async (id, payload) => {
    chamadas.push(["findAlertasByTecnicoId", id, payload]);
    return { dados: [{ id: 1 }] };
  };

  const listRes = createResponse();
  await TecnicoController.list({ query: { page: "1", limit: "5" } }, listRes, captureNext());

  const findRes = createResponse();
  await TecnicoController.findById({ params: { id: "3" } }, findRes, captureNext());

  const alertasRes = createResponse();
  await TecnicoController.findAlertasByTecnico({
    params: { id: "3" },
    query: { page: "2", limit: "10" }
  }, alertasRes, captureNext());

  assert.deepEqual(chamadas, [
    ["listAllTecnicos", { page: "1", limit: "5" }],
    ["findTecnicoById", "3"],
    ["findAlertasByTecnicoId", "3", { page: "2", limit: "10" }]
  ]);
  assert.deepEqual(listRes.body, { dados: [] });
  assert.deepEqual(findRes.body, { id: 3, role: "TECNICO" });
  assert.deepEqual(alertasRes.body, { dados: [{ id: 1 }] });
});

test("PerfilController usa usuario autenticado em perfil, device token, foto e push teste", async () => {
  const chamadas = [];
  PerfilService.findPerfil = async (id) => {
    chamadas.push(["findPerfil", id]);
    return { id };
  };
  PerfilService.updatePerfil = async (payload) => {
    chamadas.push(["updatePerfil", payload]);
    return { id: payload.id, ...payload.dados };
  };
  PerfilService.putOneSignalId = async (payload) => {
    chamadas.push(["putOneSignalId", payload]);
    return { id: payload.id, oneSignalId: payload.oneSignalId };
  };
  PerfilService.updateFotoPerfil = async (payload) => {
    chamadas.push(["updateFotoPerfil", payload]);
    return { id: payload.usuarioId, fotoPerfil: "url" };
  };
  PerfilService.deleteFotoPerfil = async (payload) => {
    chamadas.push(["deleteFotoPerfil", payload]);
    return { id: payload.usuarioId, fotoPerfil: null, caminhoFoto: null };
  };
  PerfilService.sendPushTeste = async (payload) => {
    chamadas.push(["sendPushTeste", payload]);
    return { ok: true };
  };

  const getRes = createResponse();
  await PerfilController.getPerfil({ usuario: { id: 4 } }, getRes, captureNext());

  const updateRes = createResponse();
  await PerfilController.updatePerfil({ usuario: { id: 4 }, body: { nome: "Novo" } }, updateRes, captureNext());

  const tokenRes = createResponse();
  await PerfilController.setOneSignalId({ usuario: { id: 4 }, body: { oneSignalId: "player" } }, tokenRes, captureNext());

  const fotoBuffer = Buffer.from("foto");
  const fotoRes = createResponse();
  await PerfilController.updateFoto({
    usuario: { id: 4 },
    file: { buffer: fotoBuffer }
  }, fotoRes, captureNext());

  const deleteFotoRes = createResponse();
  await PerfilController.deleteFoto({ usuario: { id: 4 } }, deleteFotoRes, captureNext());

  const pushRes = createResponse();
  await PerfilController.sendPushTeste({
    usuario: { id: 4 },
    body: { title: "Teste", message: "Oi", data: { a: 1 } }
  }, pushRes, captureNext());

  assert.deepEqual(chamadas, [
    ["findPerfil", 4],
    ["updatePerfil", { id: 4, dados: { nome: "Novo" } }],
    ["putOneSignalId", { id: 4, oneSignalId: "player" }],
    ["updateFotoPerfil", { usuarioId: 4, buffer: fotoBuffer }],
    ["deleteFotoPerfil", { usuarioId: 4 }],
    ["sendPushTeste", { id: 4, title: "Teste", message: "Oi", data: { a: 1 } }]
  ]);
  assert.deepEqual(getRes.body, { id: 4 });
  assert.deepEqual(updateRes.body, { id: 4, nome: "Novo" });
  assert.deepEqual(tokenRes.body, { id: 4, oneSignalId: "player" });
  assert.deepEqual(fotoRes.body, { id: 4, fotoPerfil: "url" });
  assert.deepEqual(deleteFotoRes.body, { id: 4, fotoPerfil: null, caminhoFoto: null });
  assert.deepEqual(pushRes.body, { ok: true });
});

test("PerfilController.updateFoto envia AppError quando arquivo nao existe", async () => {
  const next = captureNext();
  const res = createResponse();

  await PerfilController.updateFoto({ usuario: { id: 4 } }, res, next);

  assert.equal(next.calls.length, 1);
  assert.equal(next.calls[0].name, "AppError");
  assert.equal(next.calls[0].statusCode, 400);
  assert.equal(res.statusCode, null);
});

test("SensorController valida store, repassa CRUD e usa 204 no delete", async () => {
  const invalidRes = createResponse();
  await SensorController.store({ body: { tipo: "temperatura" } }, invalidRes, captureNext());

  assert.equal(invalidRes.statusCode, 400);
  assert.equal(normalizeMessage(invalidRes.body.error), "Tipo e maquinaId sao obrigatorios");

  const chamadas = [];
  SensorService.create = async (payload) => {
    chamadas.push(["create", payload]);
    return { id: 1, ...payload };
  };
  SensorService.list = async () => {
    chamadas.push(["list"]);
    return [{ id: 1 }];
  };
  SensorService.findById = async (id) => {
    chamadas.push(["findById", id]);
    return { id: Number(id) };
  };
  SensorService.update = async (id, payload) => {
    chamadas.push(["update", id, payload]);
    return { id: Number(id), ...payload };
  };
  SensorService.delete = async (id) => {
    chamadas.push(["delete", id]);
  };

  const storeRes = createResponse();
  await SensorController.store({ body: { tipo: "temperatura", maquinaId: 2 } }, storeRes, captureNext());

  const indexRes = createResponse();
  await SensorController.index({}, indexRes, captureNext());

  const showRes = createResponse();
  await SensorController.show({ params: { id: "5" } }, showRes, captureNext());

  const updateRes = createResponse();
  await SensorController.update({ params: { id: "5" }, body: { status: "OFFLINE" } }, updateRes, captureNext());

  const deleteRes = createResponse();
  await SensorController.delete({ params: { id: "5" } }, deleteRes, captureNext());

  assert.deepEqual(chamadas, [
    ["create", { tipo: "temperatura", maquinaId: 2 }],
    ["list"],
    ["findById", "5"],
    ["update", "5", { status: "OFFLINE" }],
    ["delete", "5"]
  ]);
  assert.equal(storeRes.statusCode, 201);
  assert.deepEqual(indexRes.body, [{ id: 1 }]);
  assert.deepEqual(showRes.body, { id: 5 });
  assert.deepEqual(updateRes.body, { id: 5, status: "OFFLINE" });
  assert.equal(deleteRes.statusCode, 204);
  assert.equal(deleteRes.sent, true);
});

test("controllers de usuario/perfil/sensor encaminham erros para next", async () => {
  const errors = {
    usuario: new Error("usuario falhou"),
    tecnico: new Error("tecnico falhou"),
    perfil: new Error("perfil falhou"),
    sensor: new Error("sensor falhou")
  };

  UsuarioService.findById = async () => {
    throw errors.usuario;
  };
  UsuarioService.findTecnicoById = async () => {
    throw errors.tecnico;
  };
  PerfilService.findPerfil = async () => {
    throw errors.perfil;
  };
  SensorService.findById = async () => {
    throw errors.sensor;
  };

  const usuarioNext = captureNext();
  await UsuarioController.findById({ params: { id: "1" } }, createResponse(), usuarioNext);

  const tecnicoNext = captureNext();
  await TecnicoController.findById({ params: { id: "1" } }, createResponse(), tecnicoNext);

  const perfilNext = captureNext();
  await PerfilController.getPerfil({ usuario: { id: 1 } }, createResponse(), perfilNext);

  const sensorNext = captureNext();
  await SensorController.show({ params: { id: "1" } }, createResponse(), sensorNext);

  assert.deepEqual(usuarioNext.calls, [errors.usuario]);
  assert.deepEqual(tecnicoNext.calls, [errors.tecnico]);
  assert.deepEqual(perfilNext.calls, [errors.perfil]);
  assert.deepEqual(sensorNext.calls, [errors.sensor]);
});
