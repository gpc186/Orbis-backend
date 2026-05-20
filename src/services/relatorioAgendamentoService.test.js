const assert = require("node:assert/strict");
const test = require("node:test");

const RelatorioAgendamentoModel = require("../models/relatorioAgendamentoModel");
const RelatorioAgendamentoService = require("./relatorioAgendamentoService");

test("processDueSchedules sempre retorna um array de resultados", async () => {
  const originalListDue = RelatorioAgendamentoModel.listDue;
  const originalTryLock = RelatorioAgendamentoModel.tryLock;
  const originalClearLock = RelatorioAgendamentoModel.clearLock;

  RelatorioAgendamentoModel.listDue = async () => [];
  RelatorioAgendamentoModel.tryLock = async () => true;
  RelatorioAgendamentoModel.clearLock = async () => {};

  try {
    const processed = await RelatorioAgendamentoService.processDueSchedules();

    assert.deepEqual(processed, []);
  } finally {
    RelatorioAgendamentoModel.listDue = originalListDue;
    RelatorioAgendamentoModel.tryLock = originalTryLock;
    RelatorioAgendamentoModel.clearLock = originalClearLock;
  }
});
