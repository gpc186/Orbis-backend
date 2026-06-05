const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");

const RelatorioController = require("../../../src/controllers/relatorioController");
const RelatorioAgendamentoController = require("../../../src/controllers/relatorioAgendamentoController");
const RelatorioAgendamentoService = require("../../../src/services/relatorioAgendamentoService");
const RelatorioExecucaoService = require("../../../src/services/relatorioExecucaoService");

const originals = {
  executarManual: RelatorioExecucaoService.executarManual,
  listExecutions: RelatorioExecucaoService.listExecutions,
  preview: RelatorioAgendamentoService.preview,
  create: RelatorioAgendamentoService.create,
  list: RelatorioAgendamentoService.list,
  findById: RelatorioAgendamentoService.findById,
  update: RelatorioAgendamentoService.update,
  delete: RelatorioAgendamentoService.delete,
  updateStatus: RelatorioAgendamentoService.updateStatus,
  executeNow: RelatorioAgendamentoService.executeNow
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
  RelatorioExecucaoService.executarManual = originals.executarManual;
  RelatorioExecucaoService.listExecutions = originals.listExecutions;
  RelatorioAgendamentoService.preview = originals.preview;
  RelatorioAgendamentoService.create = originals.create;
  RelatorioAgendamentoService.list = originals.list;
  RelatorioAgendamentoService.findById = originals.findById;
  RelatorioAgendamentoService.update = originals.update;
  RelatorioAgendamentoService.delete = originals.delete;
  RelatorioAgendamentoService.updateStatus = originals.updateStatus;
  RelatorioAgendamentoService.executeNow = originals.executeNow;
});

test("RelatorioController.enviarAgora repassa usuario e payload ao service", async () => {
  let payloadRecebido;
  RelatorioExecucaoService.executarManual = async (payload) => {
    payloadRecebido = payload;
    return { execucaoId: 9, destinatarios: ["time@example.com"] };
  };

  const usuario = { id: 1, role: "ADMIN" };
  const body = {
    emailsDestino: ["time@example.com"],
    assunto: "Resumo",
    nome: "Relatorio diario",
    periodo: { inicio: "2026-06-01", fim: "2026-06-04" },
    filtros: { criticidade: "ALTA" }
  };
  const res = createResponse();

  await RelatorioController.enviarAgora({ usuario, body }, res, captureNext());

  assert.deepEqual(payloadRecebido, { usuario, payload: body });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    message: "Relatorio enviado com sucesso.",
    execucaoId: 9,
    destinatarios: ["time@example.com"]
  });
});

test("RelatorioAgendamentoController repassa preview, create, list, find, update e delete", async () => {
  const usuario = { id: 1, role: "ADMIN" };
  const payload = {
    nome: "Relatorio semanal",
    emailsDestino: ["ops@example.com"],
    assunto: "Semana",
    periodo: { tipo: "ULTIMOS_7_DIAS" },
    filtros: { status: "ATIVO" },
    agendamento: { frequencia: "SEMANAL" }
  };
  const calls = [];

  RelatorioAgendamentoService.preview = async (input) => {
    calls.push(["preview", input]);
    return { html: "<p>preview</p>" };
  };
  RelatorioAgendamentoService.create = async (input) => {
    calls.push(["create", input]);
    return { id: 1 };
  };
  RelatorioAgendamentoService.list = async (input) => {
    calls.push(["list", input]);
    return { total: 1, agendamentos: [{ id: 1 }] };
  };
  RelatorioAgendamentoService.findById = async (input) => {
    calls.push(["findById", input]);
    return { id: 7 };
  };
  RelatorioAgendamentoService.update = async (input) => {
    calls.push(["update", input]);
    return { id: 7, nome: "Atualizado" };
  };
  RelatorioAgendamentoService.delete = async (input) => {
    calls.push(["delete", input]);
    return { id: 7 };
  };

  const previewRes = createResponse();
  await RelatorioAgendamentoController.preview({ usuario, body: payload }, previewRes, captureNext());

  const createRes = createResponse();
  await RelatorioAgendamentoController.create({ usuario, body: payload }, createRes, captureNext());

  const listRes = createResponse();
  await RelatorioAgendamentoController.list({ usuario }, listRes, captureNext());

  const findRes = createResponse();
  await RelatorioAgendamentoController.findById({ usuario, params: { id: "7" } }, findRes, captureNext());

  const updateRes = createResponse();
  await RelatorioAgendamentoController.update({ usuario, params: { id: "7" }, body: payload }, updateRes, captureNext());

  const deleteRes = createResponse();
  await RelatorioAgendamentoController.delete({ usuario, params: { id: "7" } }, deleteRes, captureNext());

  assert.deepEqual(calls, [
    ["preview", { usuario, payload: { nome: payload.nome, assunto: payload.assunto, periodo: payload.periodo, filtros: payload.filtros } }],
    ["create", { usuario, payload }],
    ["list", { usuario }],
    ["findById", { usuario, id: "7" }],
    ["update", { usuario, id: "7", payload }],
    ["delete", { usuario, id: "7" }]
  ]);
  assert.equal(previewRes.statusCode, 200);
  assert.deepEqual(previewRes.body, { html: "<p>preview</p>" });
  assert.equal(createRes.statusCode, 201);
  assert.deepEqual(createRes.body, { message: "Agendamento de relatorio criado com sucesso.", id: 1 });
  assert.deepEqual(listRes.body, { total: 1, agendamentos: [{ id: 1 }] });
  assert.deepEqual(findRes.body, { id: 7 });
  assert.deepEqual(updateRes.body, { message: "Agendamento de relatorio atualizado com sucesso.", id: 7, nome: "Atualizado" });
  assert.deepEqual(deleteRes.body, { message: "Agendamento de relatorio deletado com sucesso.", id: 7 });
});

test("RelatorioAgendamentoController repassa status, execucao manual e execucoes", async () => {
  const usuario = { id: 1, role: "ADMIN" };
  const calls = [];

  RelatorioAgendamentoService.updateStatus = async (input) => {
    calls.push(["updateStatus", input]);
    return { id: 4, status: "PAUSADO" };
  };
  RelatorioAgendamentoService.executeNow = async (input) => {
    calls.push(["executeNow", input]);
    return { execucaoId: 12 };
  };
  RelatorioExecucaoService.listExecutions = async (input) => {
    calls.push(["listExecutions", input]);
    return { total: 1, execucoes: [{ id: 12 }] };
  };

  const statusRes = createResponse();
  await RelatorioAgendamentoController.updateStatus(
    { usuario, params: { id: "4" }, body: { status: "PAUSADO" } },
    statusRes,
    captureNext()
  );

  const executeRes = createResponse();
  await RelatorioAgendamentoController.executeNow({ usuario, params: { id: "4" } }, executeRes, captureNext());

  const execucoesRes = createResponse();
  await RelatorioAgendamentoController.listExecutions({ usuario, params: { id: "4" } }, execucoesRes, captureNext());

  assert.deepEqual(calls, [
    ["updateStatus", { usuario, id: "4", payload: { status: "PAUSADO" } }],
    ["executeNow", { usuario, id: "4" }],
    ["listExecutions", { id: "4", usuario }]
  ]);
  assert.deepEqual(statusRes.body, { message: "Status do agendamento atualizado com sucesso.", id: 4, status: "PAUSADO" });
  assert.deepEqual(executeRes.body, { message: "Execucao manual do agendamento concluida.", execucaoId: 12 });
  assert.deepEqual(execucoesRes.body, { total: 1, execucoes: [{ id: 12 }] });
});

test("controllers de relatorio encaminham erros para next", async () => {
  const manualError = new Error("manual falhou");
  RelatorioExecucaoService.executarManual = async () => {
    throw manualError;
  };

  const manualNext = captureNext();
  await RelatorioController.enviarAgora({ usuario: { id: 1 }, body: {} }, createResponse(), manualNext);

  const agendamentoError = new Error("agendamento falhou");
  RelatorioAgendamentoService.findById = async () => {
    throw agendamentoError;
  };

  const agendamentoNext = captureNext();
  await RelatorioAgendamentoController.findById(
    { usuario: { id: 1 }, params: { id: "1" } },
    createResponse(),
    agendamentoNext
  );

  assert.deepEqual(manualNext.calls, [manualError]);
  assert.deepEqual(agendamentoNext.calls, [agendamentoError]);
});
