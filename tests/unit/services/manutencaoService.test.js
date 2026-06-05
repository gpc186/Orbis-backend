const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");

const ManutencaoService = require("../../../src/services/manutencaoService");
const AlertaModel = require("../../../src/models/alertaModel");
const ManutencaoModel = require("../../../src/models/manutencaoModel");
const UsuarioModel = require("../../../src/models/usuarioModel");

const originals = {
  alertaFindById: AlertaModel.findById,
  manutencaoFindByAlertaId: ManutencaoModel.findByAlertaId,
  manutencaoCreateWithAlertSync: ManutencaoModel.createWithAlertSync,
  manutencaoFindById: ManutencaoModel.findById,
  manutencaoUpdateWithAlertSync: ManutencaoModel.updateWithAlertSync,
  usuarioFindById: UsuarioModel.findById
};

afterEach(() => {
  AlertaModel.findById = originals.alertaFindById;
  ManutencaoModel.findByAlertaId = originals.manutencaoFindByAlertaId;
  ManutencaoModel.createWithAlertSync = originals.manutencaoCreateWithAlertSync;
  ManutencaoModel.findById = originals.manutencaoFindById;
  ManutencaoModel.updateWithAlertSync = originals.manutencaoUpdateWithAlertSync;
  UsuarioModel.findById = originals.usuarioFindById;
});

test("create valida entidades e cria manutencao em andamento sincronizada com alerta", async () => {
  AlertaModel.findById = async () => ({ id: 10, status: "ATIVO" });
  ManutencaoModel.findByAlertaId = async () => [{ id: 1, status: "RESOLVIDO" }];
  UsuarioModel.findById = async () => ({ id: 7, ativo: true });

  let payloadRecebido;
  ManutencaoModel.createWithAlertSync = async (payload) => {
    payloadRecebido = payload;
    return { id: 99, ...payload };
  };

  const result = await ManutencaoService.create({
    alertaId: "10",
    usuarioId: "7",
    observacao: "  troca preventiva  "
  });

  assert.deepEqual(payloadRecebido, {
    alertaId: 10,
    usuarioId: 7,
    observacao: "troca preventiva",
    status: "EM_ANDAMENTO"
  });
  assert.equal(result.id, 99);
});

test("create bloqueia alerta encerrado e manutencao ja em andamento", async () => {
  AlertaModel.findById = async () => ({ id: 10, status: "RESOLVIDO" });

  await assert.rejects(
    () => ManutencaoService.create({ alertaId: "10", usuarioId: "7", observacao: "ok ok" }),
    (error) => error.name === "AppError" && error.statusCode === 400
  );

  AlertaModel.findById = async () => ({ id: 10, status: "ATIVO" });
  ManutencaoModel.findByAlertaId = async () => [{ id: 2, status: "EM_ANDAMENTO" }];

  await assert.rejects(
    () => ManutencaoService.create({ alertaId: "10", usuarioId: "7", observacao: "ok ok" }),
    (error) => error.name === "AppError" && error.statusCode === 400
  );
});

test("create bloqueia usuario inativo", async () => {
  AlertaModel.findById = async () => ({ id: 10, status: "ATIVO" });
  ManutencaoModel.findByAlertaId = async () => [];
  UsuarioModel.findById = async () => ({ id: 7, ativo: false });

  await assert.rejects(
    () => ManutencaoService.create({ alertaId: "10", usuarioId: "7", observacao: "ok ok" }),
    (error) => error.name === "AppError" && error.statusCode === 400
  );
});

test("update valida responsavel e envia apenas campos normalizados", async () => {
  ManutencaoModel.findById = async () => ({
    id: 5,
    alertaId: 10,
    usuarioId: 7,
    status: "EM_ANDAMENTO"
  });
  UsuarioModel.findById = async () => ({ id: 7, ativo: true });

  let payloadRecebido;
  ManutencaoModel.updateWithAlertSync = async (payload) => {
    payloadRecebido = payload;
    return { id: payload.manutencaoId, ...payload.dados };
  };

  const result = await ManutencaoService.update("5", "7", {
    dados: {
      observacao: "  resolvido no local  ",
      status: "RESOLVIDO"
    }
  });

  assert.deepEqual(payloadRecebido, {
    manutencaoId: 5,
    alertaId: 10,
    usuarioId: 7,
    dados: {
      observacao: "resolvido no local",
      status: "RESOLVIDO"
    }
  });
  assert.equal(result.status, "RESOLVIDO");
});

test("update bloqueia manutencao encerrada, outro tecnico e payload vazio", async () => {
  ManutencaoModel.findById = async () => ({ id: 5, usuarioId: 7, status: "RESOLVIDO" });

  await assert.rejects(
    () => ManutencaoService.update("5", "7", { dados: { observacao: "nova obs" } }),
    (error) => error.name === "AppError" && error.statusCode === 409
  );

  ManutencaoModel.findById = async () => ({
    id: 5,
    alertaId: 10,
    usuarioId: 7,
    status: "EM_ANDAMENTO"
  });
  UsuarioModel.findById = async () => ({ id: 8, ativo: true });

  await assert.rejects(
    () => ManutencaoService.update("5", "8", { dados: { observacao: "nova obs" } }),
    (error) => error.name === "AppError" && error.statusCode === 403
  );

  UsuarioModel.findById = async () => ({ id: 7, ativo: true });

  await assert.rejects(
    () => ManutencaoService.update("5", "7", { dados: {} }),
    (error) => error.name === "AppError" && error.statusCode === 400
  );
});
