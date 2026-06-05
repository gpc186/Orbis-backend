const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");

const HistoricoIntegridadeService = require("../../../src/services/historicoIntegridadeService");
const HistoricoIntegridadeModel = require("../../../src/models/historicoIntegridadeModel");
const MaquinaModel = require("../../../src/models/maquinaModel");

const originals = {
  createHistorico: HistoricoIntegridadeModel.create,
  findAllHistorico: HistoricoIntegridadeModel.findAll,
  findHistoricoById: HistoricoIntegridadeModel.findById,
  findMaquinaById: MaquinaModel.findById
};

afterEach(() => {
  HistoricoIntegridadeModel.create = originals.createHistorico;
  HistoricoIntegridadeModel.findAll = originals.findAllHistorico;
  HistoricoIntegridadeModel.findById = originals.findHistoricoById;
  MaquinaModel.findById = originals.findMaquinaById;
});

test("normalizadores validam limite, percentual e data", () => {
  assert.equal(HistoricoIntegridadeService.normalizarLimite(undefined), 100);
  assert.equal(HistoricoIntegridadeService.normalizarLimite("1000"), 500);
  assert.equal(HistoricoIntegridadeService.normalizarLimite("12.8"), 12);
  assert.equal(HistoricoIntegridadeService.normalizarPercentual("87.456", "integridade"), 87.46);
  assert.equal(HistoricoIntegridadeService.normalizarData("2026-06-04", "dataInicio").toISOString(), "2026-06-04T00:00:00.000Z");

  assert.throws(
    () => HistoricoIntegridadeService.normalizarPercentual(101, "integridade"),
    /integridade deve ser um numero entre 0 e 100/
  );
  assert.throws(() => HistoricoIntegridadeService.normalizarData("invalida", "dataFim"), /dataFim invalida/);
});

test("create valida maquina, normaliza dados e persiste historico", async () => {
  let dadosRecebidos;
  MaquinaModel.findById = async (id) => ({ id, scoreEstabilidade: 72.345 });
  HistoricoIntegridadeModel.create = async (dados) => {
    dadosRecebidos = dados;
    return { id: 10, ...dados };
  };

  const result = await HistoricoIntegridadeService.create({
    maquinaId: "5",
    integridade: "88.888",
    observacao: "registro manual"
  });

  assert.deepEqual(dadosRecebidos, {
    maquinaId: 5,
    integridade: 88.89,
    scoreEstabilidade: 72.345,
    origem: "REGISTRO_MANUAL",
    observacao: "registro manual"
  });
  assert.equal(result.id, 10);
});

test("create falha para maquina invalida, inexistente ou percentual invalido", async () => {
  await assert.rejects(
    () => HistoricoIntegridadeService.create({ maquinaId: "abc", integridade: 80 }),
    /maquinaId invalido/
  );

  MaquinaModel.findById = async () => null;
  await assert.rejects(
    () => HistoricoIntegridadeService.create({ maquinaId: 1, integridade: 80 }),
    /Maquina nao encontrada/
  );

  MaquinaModel.findById = async () => ({ id: 1, scoreEstabilidade: 90 });
  await assert.rejects(
    () => HistoricoIntegridadeService.create({ maquinaId: 1, integridade: -1 }),
    /integridade deve ser um numero entre 0 e 100/
  );
});

test("list normaliza filtros e valida intervalo de datas", async () => {
  let filtrosRecebidos;
  HistoricoIntegridadeModel.findAll = async (filtros) => {
    filtrosRecebidos = filtros;
    return [{ id: 1 }];
  };

  const result = await HistoricoIntegridadeService.list({
    maquinaId: "3",
    dataInicio: "2026-06-01T00:00:00.000Z",
    dataFim: "2026-06-04T00:00:00.000Z",
    limite: "20"
  });

  assert.deepEqual(result, [{ id: 1 }]);
  assert.equal(filtrosRecebidos.maquinaId, "3");
  assert.equal(filtrosRecebidos.limite, 20);
  assert.equal(filtrosRecebidos.dataInicio.toISOString(), "2026-06-01T00:00:00.000Z");
  assert.equal(filtrosRecebidos.dataFim.toISOString(), "2026-06-04T00:00:00.000Z");

  await assert.rejects(
    () => HistoricoIntegridadeService.list({ dataInicio: "2026-06-05", dataFim: "2026-06-04" }),
    /dataInicio nao pode ser maior que dataFim/
  );
  await assert.rejects(() => HistoricoIntegridadeService.list({ maquinaId: "0" }), /maquinaId invalido/);
});

test("listByMaquina valida existencia da maquina e delega filtros para list", async () => {
  let filtrosRecebidos;
  MaquinaModel.findById = async (id) => ({ id });
  HistoricoIntegridadeModel.findAll = async (filtros) => {
    filtrosRecebidos = filtros;
    return [{ id: 2 }];
  };

  const result = await HistoricoIntegridadeService.listByMaquina(8, { limite: 5 });

  assert.deepEqual(result, [{ id: 2 }]);
  assert.equal(filtrosRecebidos.maquinaId, 8);
  assert.equal(filtrosRecebidos.limite, 5);

  MaquinaModel.findById = async () => null;
  await assert.rejects(() => HistoricoIntegridadeService.listByMaquina(99), /Maquina nao encontrada/);
});

test("findById retorna historico ou preserva erro 404", async () => {
  HistoricoIntegridadeModel.findById = async (id) => ({ id, integridade: 90 });

  await assert.deepEqual(await HistoricoIntegridadeService.findById(4), { id: 4, integridade: 90 });

  HistoricoIntegridadeModel.findById = async () => null;
  await assert.rejects(() => HistoricoIntegridadeService.findById(404), /Historico de integridade nao encontrado/);
});
