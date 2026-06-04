const assert = require("node:assert/strict");
const test = require("node:test");

const AppError = require("../../utils/appErrorUtils");
const RelatorioExecucaoService = require("../relatorioExecucaoService");
const {
  prepareWriteToolAction,
  executeWriteTool
} = require("./writeActions");

test("prepareWriteToolAction valida payload e normaliza destinatarios para enviar_relatorio_agora", async () => {
  const action = await prepareWriteToolAction({
    name: "enviar_relatorio_agora",
    args: {
      nome: "Relatorio Operacional",
      assunto: "Resumo Diario",
      emailsDestino: ["ADMIN@orbis.local ", "admin@orbis.local", "tecnico@orbis.local"],
      periodo: {
        tipo: "RELATIVE_DAYS",
        valor: 7
      },
      filtros: {
        secoes: ["resumo", "sensores"]
      }
    },
    usuario: {
      id: 1,
      role: "ADMIN"
    }
  });

  assert.equal(action.name, "enviar_relatorio_agora");
  assert.equal(action.actionLabel, "Enviar relatorio agora");
  assert.deepEqual(action.args.emailsDestino, [
    "admin@orbis.local",
    "tecnico@orbis.local"
  ]);
  assert.deepEqual(action.summary.secoes, ["resumo", "sensores"]);
});

test("prepareWriteToolAction bloqueia tecnico em tool administrativa de relatorio", async () => {
  await assert.rejects(
    () => prepareWriteToolAction({
      name: "enviar_relatorio_agora",
      args: {
        emailsDestino: ["admin@orbis.local"],
        periodo: { tipo: "RELATIVE_DAYS", valor: 7 },
        filtros: { secoes: ["resumo"] }
      },
      usuario: {
        id: 2,
        role: "TECNICO"
      }
    }),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 403);
      assert.equal(error.message, "Usuario sem permissao para usar tools administrativas.");
      return true;
    }
  );
});

test("executeWriteTool delega envio manual ao RelatorioExecucaoService", async () => {
  const originalExecutarManual = RelatorioExecucaoService.executarManual;
  let capturedArgs = null;

  RelatorioExecucaoService.executarManual = async (args) => {
    capturedArgs = args;
    return {
      execucaoId: 15,
      provider: "mock",
      messageId: "msg-1",
      subject: "Resumo Diario",
      enviadoPara: ["admin@orbis.local"],
      quantidadeDestinatarios: 1,
      enviadoEm: "02/06/2026 10:00",
      origemTemplate: "backend"
    };
  };

  try {
    const usuario = { id: 1, role: "ADMIN" };
    const action = {
      name: "enviar_relatorio_agora",
      args: {
        nome: "Relatorio Operacional",
        assunto: "Resumo Diario",
        emailsDestino: ["admin@orbis.local"],
        periodo: { tipo: "RELATIVE_DAYS", valor: 7 },
        filtros: { secoes: ["resumo"] }
      }
    };

    const result = await executeWriteTool({ action, usuario });

    assert.deepEqual(capturedArgs, {
      usuario,
      payload: action.args
    });
    assert.equal(result.message, "Relatorio enviado com sucesso.");
    assert.equal(result.execucaoId, 15);
    assert.deepEqual(result.enviadoPara, ["admin@orbis.local"]);
  } finally {
    RelatorioExecucaoService.executarManual = originalExecutarManual;
  }
});
