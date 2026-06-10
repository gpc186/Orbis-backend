const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");

const ManutencaoService = require("../../../src/services/manutencaoService");
const AlertaModel = require("../../../src/models/alertaModel");
const MaquinaModel = require("../../../src/models/maquinaModel");
const ManutencaoModel = require("../../../src/models/manutencaoModel");
const UsuarioModel = require("../../../src/models/usuarioModel");
const simuladorJob = require("../../../src/jobs/simuladorJob");

const originals = {
  alertaFindById: AlertaModel.findById,
  maquinaFindById: MaquinaModel.findById,
  manutencaoCreate: ManutencaoModel.create,
  manutencaoFindAll: ManutencaoModel.findAll,
  manutencaoCount: ManutencaoModel.count,
  manutencaoFindByAlertaId: ManutencaoModel.findByAlertaId,
  manutencaoCreateWithAlertSync: ManutencaoModel.createWithAlertSync,
  manutencaoFindById: ManutencaoModel.findById,
  manutencaoUpdateWithAlertSync: ManutencaoModel.updateWithAlertSync,
  manutencaoUpdatePreventiva: ManutencaoModel.updatePreventiva,
  usuarioFindById: UsuarioModel.findById,
  resetarMaquinaSimulada: simuladorJob.resetarMaquinaSimulada
};

afterEach(() => {
  AlertaModel.findById = originals.alertaFindById;
  MaquinaModel.findById = originals.maquinaFindById;
  ManutencaoModel.create = originals.manutencaoCreate;
  ManutencaoModel.findAll = originals.manutencaoFindAll;
  ManutencaoModel.count = originals.manutencaoCount;
  ManutencaoModel.findByAlertaId = originals.manutencaoFindByAlertaId;
  ManutencaoModel.createWithAlertSync = originals.manutencaoCreateWithAlertSync;
  ManutencaoModel.findById = originals.manutencaoFindById;
  ManutencaoModel.updateWithAlertSync = originals.manutencaoUpdateWithAlertSync;
  ManutencaoModel.updatePreventiva = originals.manutencaoUpdatePreventiva;
  UsuarioModel.findById = originals.usuarioFindById;
  simuladorJob.resetarMaquinaSimulada = originals.resetarMaquinaSimulada;
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

test("create cria manutencao preventiva vinculada a maquina sem alerta", async () => {
  UsuarioModel.findById = async () => ({ id: 7, ativo: true });
  MaquinaModel.findById = async () => ({ id: 22, ativo: true });

  let payloadRecebido;
  ManutencaoModel.create = async (payload) => {
    payloadRecebido = payload;
    return { id: 101, ...payload };
  };

  const result = await ManutencaoService.create({
    tipo: "PREVENTIVA",
    maquinaId: "22",
    usuarioId: "7",
    observacao: "  inspecao mensal  "
  });

  assert.deepEqual(payloadRecebido, {
    alertaId: null,
    maquinaId: 22,
    usuarioId: 7,
    tipo: "PREVENTIVA",
    observacao: "inspecao mensal",
    status: "EM_ANDAMENTO"
  });
  assert.equal(result.id, 101);
  assert.equal(result.alertaId, null);
});

test("create bloqueia alerta encerrado e manutencao ja em andamento", async () => {
  UsuarioModel.findById = async () => ({ id: 7, ativo: true });
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

test("create preventiva bloqueia maquina inexistente ou inativa", async () => {
  UsuarioModel.findById = async () => ({ id: 7, ativo: true });
  MaquinaModel.findById = async () => null;

  await assert.rejects(
    () => ManutencaoService.create({ tipo: "PREVENTIVA", maquinaId: "22", usuarioId: "7", observacao: "ok ok" }),
    (error) => error.name === "AppError" && error.statusCode === 404
  );

  MaquinaModel.findById = async () => ({ id: 22, ativo: false });

  await assert.rejects(
    () => ManutencaoService.create({ tipo: "PREVENTIVA", maquinaId: "22", usuarioId: "7", observacao: "ok ok" }),
    (error) => error.name === "AppError" && error.statusCode === 400
  );
});

test("create bloqueia usuario inativo", async () => {
  UsuarioModel.findById = async () => ({ id: 7, ativo: false });

  await assert.rejects(
    () => ManutencaoService.create({ alertaId: "10", usuarioId: "7", observacao: "ok ok" }),
    (error) => error.name === "AppError" && error.statusCode === 400
  );
});

test("list filtra apenas preventivas para tecnico e lista tudo para admin", async () => {
  const chamadas = [];
  ManutencaoModel.findAll = async (payload) => {
    chamadas.push(["findAll", payload]);
    return [];
  };
  ManutencaoModel.count = async (where) => {
    chamadas.push(["count", where]);
    return 0;
  };

  await ManutencaoService.list({ page: "1", limit: "5", usuario: { role: "TECNICO" } });
  await ManutencaoService.list({ page: "1", limit: "5", usuario: { role: "ADMIN" } });

  assert.deepEqual(chamadas, [
    ["findAll", { skip: 0, take: 5, where: { tipo: "PREVENTIVA" } }],
    ["count", { tipo: "PREVENTIVA" }],
    ["findAll", { skip: 0, take: 5, where: {} }],
    ["count", {}]
  ]);
});

test("update valida responsavel e envia apenas campos normalizados", async () => {
  ManutencaoModel.findById = async () => ({
    id: 5,
    alertaId: 10,
    maquinaId: 55,
    tipo: "CORRETIVA",
    usuarioId: 7,
    status: "EM_ANDAMENTO",
    alerta: { maquinaId: 55 }
  });
  UsuarioModel.findById = async () => ({ id: 7, ativo: true });

  let payloadRecebido;
  let maquinaResetada = null;
  ManutencaoModel.updateWithAlertSync = async (payload) => {
    payloadRecebido = payload;
    return { id: payload.manutencaoId, ...payload.dados };
  };
  simuladorJob.resetarMaquinaSimulada = (maquinaId) => {
    maquinaResetada = maquinaId;
    return true;
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
  assert.equal(maquinaResetada, 55);
});

test("update preventiva nao sincroniza alerta e reseta maquina da manutencao", async () => {
  ManutencaoModel.findById = async () => ({
    id: 5,
    alertaId: null,
    maquinaId: 22,
    tipo: "PREVENTIVA",
    usuarioId: 7,
    status: "EM_ANDAMENTO",
    alerta: null
  });
  UsuarioModel.findById = async () => ({ id: 7, ativo: true });

  let payloadRecebido;
  let maquinaResetada = null;
  ManutencaoModel.updatePreventiva = async (payload) => {
    payloadRecebido = payload;
    return { id: payload.manutencaoId, tipo: "PREVENTIVA", ...payload.dados };
  };
  ManutencaoModel.updateWithAlertSync = async () => {
    throw new Error("nao deveria sincronizar alerta");
  };
  simuladorJob.resetarMaquinaSimulada = (maquinaId) => {
    maquinaResetada = maquinaId;
    return true;
  };

  const result = await ManutencaoService.update("5", "7", {
    dados: {
      observacao: "  revisao finalizada  ",
      status: "RESOLVIDO"
    }
  });

  assert.deepEqual(payloadRecebido, {
    manutencaoId: 5,
    dados: {
      observacao: "revisao finalizada",
      status: "RESOLVIDO"
    }
  });
  assert.equal(result.status, "RESOLVIDO");
  assert.equal(maquinaResetada, 22);
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
