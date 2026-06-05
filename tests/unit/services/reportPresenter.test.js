const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  mapRelatorioAgendamentoResponse,
  mapRelatorioExecucaoResponse
} = require("../../../src/services/reportPresenter");

test("mapRelatorioAgendamentoResponse formata datas e adiciona descricao do agendamento", () => {
  const result = mapRelatorioAgendamentoResponse({
    id: 1,
    nome: "Relatorio semanal",
    frequencia: "SEMANAL",
    hora: 8,
    minuto: 5,
    diaSemana: 1,
    diaMes: null,
    proximoEnvioEm: new Date("2026-06-08T11:05:00.123Z"),
    ultimoEnvioEm: null,
    ultimoSucessoEm: "2026-06-01T11:05:00.000Z",
    criadoEm: "valor-invalido",
    atualizadoEm: new Date("2026-06-04T12:00:00.000Z")
  });

  assert.equal(result.id, 1);
  assert.equal(result.descricaoAgendamento, "Semanal toda Segunda as 08:05");
  assert.match(result.proximoEnvioEm, /^2026-06-08T08:05:00\.123/);
  assert.equal(result.ultimoEnvioEm, null);
  assert.match(result.ultimoSucessoEm, /^2026-06-01T08:05:00\.000/);
  assert.equal(result.criadoEm, null);
  assert.match(result.atualizadoEm, /^2026-06-04T09:00:00\.000/);
});

test("mapRelatorioExecucaoResponse formata datas de inicio e fim", () => {
  const result = mapRelatorioExecucaoResponse({
    id: 20,
    status: "SUCESSO",
    iniciadoEm: "2026-06-04T12:00:00.000Z",
    finalizadoEm: null
  });

  assert.equal(result.id, 20);
  assert.equal(result.status, "SUCESSO");
  assert.match(result.iniciadoEm, /^2026-06-04T09:00:00\.000/);
  assert.equal(result.finalizadoEm, null);
});
