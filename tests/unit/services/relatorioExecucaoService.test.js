const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");

const RelatorioExecucaoService = require("../../../src/services/relatorioExecucaoService");
const RelatorioRendererService = require("../../../src/services/relatorioRendererService");
const EmailService = require("../../../src/services/emailService");
const RelatorioExecucaoModel = require("../../../src/models/relatorioExecucaoModel");
const RelatorioAgendamentoModel = require("../../../src/models/relatorioAgendamentoModel");

const originals = {
  render: RelatorioRendererService.render,
  send: EmailService.send,
  createExecution: RelatorioExecucaoModel.create,
  markSuccess: RelatorioExecucaoModel.markSuccess,
  markFailure: RelatorioExecucaoModel.markFailure,
  findByAgendamentoId: RelatorioExecucaoModel.findByAgendamentoId,
  findAgendamentoById: RelatorioAgendamentoModel.findById,
  markScheduledSuccess: RelatorioAgendamentoModel.markScheduledSuccess,
  markScheduledError: RelatorioAgendamentoModel.markScheduledError,
  markExecutionSuccess: RelatorioAgendamentoModel.markExecutionSuccess,
  markExecutionFailure: RelatorioAgendamentoModel.markExecutionFailure
};

afterEach(() => {
  RelatorioRendererService.render = originals.render;
  EmailService.send = originals.send;
  RelatorioExecucaoModel.create = originals.createExecution;
  RelatorioExecucaoModel.markSuccess = originals.markSuccess;
  RelatorioExecucaoModel.markFailure = originals.markFailure;
  RelatorioExecucaoModel.findByAgendamentoId = originals.findByAgendamentoId;
  RelatorioAgendamentoModel.findById = originals.findAgendamentoById;
  RelatorioAgendamentoModel.markScheduledSuccess = originals.markScheduledSuccess;
  RelatorioAgendamentoModel.markScheduledError = originals.markScheduledError;
  RelatorioAgendamentoModel.markExecutionSuccess = originals.markExecutionSuccess;
  RelatorioAgendamentoModel.markExecutionFailure = originals.markExecutionFailure;
});

function buildPayload() {
  return {
    nome: "Relatorio Semanal",
    assunto: "Resumo da semana",
    emailsDestino: ["Time@Example.com", "time@example.com", "ops@example.com"],
    periodo: { tipo: "RELATIVE_DAYS", valor: 7 },
    filtros: {
      maquinasIds: [1, "2", "x"],
      sensoresIds: [3],
      secoes: ["resumo", "sensores"]
    }
  };
}

test("executarManual valida payload, cria execucao, envia email e marca sucesso", async () => {
  RelatorioRendererService.render = async (normalized) => ({
    subject: normalized.assunto,
    html: "<p>ok</p>",
    text: "ok"
  });

  let createPayload;
  RelatorioExecucaoModel.create = async (payload) => {
    createPayload = payload;
    return { id: 42, ...payload };
  };

  let sendPayload;
  EmailService.send = async (payload) => {
    sendPayload = payload;
    return { provider: "resend", messageId: "msg-1" };
  };

  let successPayload;
  RelatorioExecucaoModel.markSuccess = async (id, payload) => {
    successPayload = { id, payload };
  };

  const result = await RelatorioExecucaoService.executarManual({
    usuario: { id: 1, role: "ADMIN" },
    payload: buildPayload()
  });

  assert.deepEqual(createPayload, {
    agendamentoId: null,
    tipoExecucao: "MANUAL",
    status: "PROCESSANDO",
    assunto: "Resumo da semana",
    emailsDestino: ["time@example.com", "ops@example.com"],
    periodoSnapshot: { tipo: "RELATIVE_DAYS", valor: 7 },
    filtrosSnapshot: {
      maquinasIds: [1, 2],
      sensoresIds: [3],
      usuariosIds: [],
      secoes: ["resumo", "sensores"]
    },
    secoes: ["resumo", "sensores"]
  });
  assert.deepEqual(sendPayload.to, ["time@example.com", "ops@example.com"]);
  assert.equal(successPayload.id, 42);
  assert.equal(successPayload.payload.provider, "resend");
  assert.equal(result.execucaoId, 42);
  assert.equal(result.quantidadeDestinatarios, 2);
  assert.equal(result.origemTemplate, "backend");
});

test("executarManual permite visitante enviar relatorio avulso", async () => {
  RelatorioRendererService.render = async (normalized) => ({
    subject: normalized.assunto,
    html: "<p>ok</p>",
    text: "ok"
  });

  RelatorioExecucaoModel.create = async (payload) => ({ id: 44, ...payload });
  RelatorioExecucaoModel.markSuccess = async () => {};
  EmailService.send = async () => ({ provider: "resend", messageId: "msg-visitante" });

  const result = await RelatorioExecucaoService.executarManual({
    usuario: { id: 3, role: "VISITANTE" },
    payload: buildPayload()
  });

  assert.equal(result.execucaoId, 44);
  assert.equal(result.messageId, "msg-visitante");
  assert.equal(result.quantidadeDestinatarios, 2);
});

test("executarManual bloqueia tecnico e marca falha quando envio falha", async () => {
  await assert.rejects(
    () => RelatorioExecucaoService.executarManual({
      usuario: { id: 2, role: "TECNICO" },
      payload: buildPayload()
    }),
    (error) => error.name === "AppError" && error.statusCode === 403
  );

  RelatorioRendererService.render = async () => ({
    subject: "Resumo",
    html: "<p>ok</p>",
    text: "ok"
  });
  RelatorioExecucaoModel.create = async (payload) => ({ id: 43, ...payload });
  EmailService.send = async () => {
    throw new Error("email fora");
  };

  let failurePayload;
  RelatorioExecucaoModel.markFailure = async (id, payload) => {
    failurePayload = { id, payload };
  };

  await assert.rejects(
    () => RelatorioExecucaoService.executarManual({
      usuario: { id: 1, role: "ADMIN" },
      payload: buildPayload()
    }),
    /email fora/
  );

  assert.equal(failurePayload.id, 43);
  assert.equal(failurePayload.payload.errorMessage, "email fora");
  assert.ok(failurePayload.payload.finalizadoEm instanceof Date);
});

function buildAgendamento(overrides = {}) {
  return {
    id: 12,
    nome: "Relatorio Diario",
    assunto: "Resumo diario",
    frequencia: "DIARIO",
    hora: 8,
    minuto: 30,
    diaSemana: null,
    diaMes: null,
    periodo: { tipo: "RELATIVE_DAYS", valor: 1 },
    filtros: { maquinasIds: [1], secoes: ["resumo"] },
    secoes: ["resumo"],
    proximoEnvioEm: new Date("2026-06-04T11:30:00.000Z"),
    destinatarios: [
      { email: "ops@example.com" },
      { email: "gestao@example.com" }
    ],
    ...overrides
  };
}

test("executarAgendamento envia relatorio agendado e atualiza proxima execucao", async () => {
  RelatorioAgendamentoModel.findById = async () => buildAgendamento();
  RelatorioRendererService.render = async () => ({
    subject: "Resumo diario",
    html: "<p>ok</p>",
    text: "ok"
  });

  let createPayload;
  RelatorioExecucaoModel.create = async (payload) => {
    createPayload = payload;
    return { id: 50, ...payload };
  };
  EmailService.send = async () => ({ provider: "resend", messageId: "msg-50" });

  let successPayload;
  let schedulePayload;
  RelatorioExecucaoModel.markSuccess = async (id, payload) => {
    successPayload = { id, payload };
  };
  RelatorioAgendamentoModel.markScheduledSuccess = async (payload) => {
    schedulePayload = payload;
  };

  const result = await RelatorioExecucaoService.executarAgendamento(12);

  assert.deepEqual(createPayload, {
    agendamentoId: 12,
    tipoExecucao: "AGENDADO",
    status: "PROCESSANDO",
    assunto: "Resumo diario",
    emailsDestino: ["ops@example.com", "gestao@example.com"],
    periodoSnapshot: { tipo: "RELATIVE_DAYS", valor: 1 },
    filtrosSnapshot: { maquinasIds: [1], secoes: ["resumo"] },
    secoes: ["resumo"]
  });
  assert.equal(successPayload.id, 50);
  assert.equal(schedulePayload.id, 12);
  assert.ok(schedulePayload.sentAt instanceof Date);
  assert.ok(schedulePayload.nextRunAt instanceof Date);
  assert.equal(result.execucaoId, 50);
  assert.equal(result.tipoExecucao, "AGENDADO");
});

test("executarAgendamento manual nao recalcula agenda e usa markExecutionSuccess", async () => {
  RelatorioAgendamentoModel.findById = async () => buildAgendamento();
  RelatorioRendererService.render = async () => ({
    subject: "Resumo diario",
    html: "<p>ok</p>",
    text: "ok"
  });
  RelatorioExecucaoModel.create = async (payload) => ({ id: 51, ...payload });
  RelatorioExecucaoModel.markSuccess = async () => {};
  EmailService.send = async () => ({ provider: "resend", messageId: "msg-51" });

  let executionSuccessPayload;
  RelatorioAgendamentoModel.markExecutionSuccess = async (payload) => {
    executionSuccessPayload = payload;
  };
  RelatorioAgendamentoModel.markScheduledSuccess = async () => {
    throw new Error("nao deveria recalcular agenda");
  };

  const result = await RelatorioExecucaoService.executarAgendamento(12, {
    updateSchedule: false,
    tipoExecucao: "MANUAL"
  });

  assert.equal(executionSuccessPayload.id, 12);
  assert.ok(executionSuccessPayload.sentAt instanceof Date);
  assert.equal(result.tipoExecucao, "MANUAL");
});

test("executarAgendamento marca erro correto quando envio falha", async () => {
  RelatorioAgendamentoModel.findById = async () => buildAgendamento();
  RelatorioRendererService.render = async () => ({
    subject: "Resumo diario",
    html: "<p>ok</p>",
    text: "ok"
  });
  RelatorioExecucaoModel.create = async (payload) => ({ id: 52, ...payload });
  EmailService.send = async () => {
    throw new Error("smtp fora");
  };

  let failurePayload;
  let scheduleErrorPayload;
  RelatorioExecucaoModel.markFailure = async (id, payload) => {
    failurePayload = { id, payload };
  };
  RelatorioAgendamentoModel.markScheduledError = async (payload) => {
    scheduleErrorPayload = payload;
  };

  await assert.rejects(
    () => RelatorioExecucaoService.executarAgendamento(12),
    /smtp fora/
  );

  assert.equal(failurePayload.id, 52);
  assert.equal(failurePayload.payload.errorMessage, "smtp fora");
  assert.equal(scheduleErrorPayload.id, 12);
  assert.equal(scheduleErrorPayload.errorMessage, "smtp fora");
  assert.ok(scheduleErrorPayload.attemptedAt instanceof Date);
});

test("executarAgendamento preserva 404 quando agendamento nao existe", async () => {
  RelatorioAgendamentoModel.findById = async () => null;

  await assert.rejects(
    () => RelatorioExecucaoService.executarAgendamento(404),
    (error) => error.name === "AppError" && error.statusCode === 404
  );
});

test("listExecutions permite admin/visitante e mapeia datas de execucao", async () => {
  await assert.rejects(
    () => RelatorioExecucaoService.listExecutions({
      id: 1,
      usuario: { id: 2, role: "TECNICO" }
    }),
    (error) => error.name === "AppError" && error.statusCode === 403
  );

  RelatorioExecucaoModel.findByAgendamentoId = async () => [
    {
      id: 1,
      iniciadoEm: new Date("2026-06-04T12:00:00.000Z"),
      finalizadoEm: null
    }
  ];

  const result = await RelatorioExecucaoService.listExecutions({
    id: 1,
    usuario: { id: 1, role: "ADMIN" }
  });

  assert.equal(result[0].id, 1);
  assert.match(result[0].iniciadoEm, /^2026-06-04T/);
  assert.equal(result[0].finalizadoEm, null);

  const visitorResult = await RelatorioExecucaoService.listExecutions({
    id: 1,
    usuario: { id: 3, role: "VISITANTE" }
  });

  assert.equal(visitorResult[0].id, 1);
});
