const assert = require("node:assert/strict");
const test = require("node:test");

const AppError = require("../../../src/utils/appErrorUtils");
const { assertRole } = require("../../../src/utils/authorization");
const {
  normalizeLimit,
  parseFiniteNumber,
  parseIntegerId,
  parseBooleanLike
} = require("../../../src/utils/requestParsers");
const { validateDestinatarios } = require("../../../src/utils/reportValidation");
const { buildConfirmationSummaryText } = require("../../../src/services/dashboardAiConfirmationPresenter");

test("assertRole permite role valida e bloqueia role invalida com mensagem customizada", async () => {
  assert.doesNotThrow(() => {
    assertRole({
      usuario: { id: 1, role: "ADMIN" },
      roles: ["ADMIN", "TECNICO"],
      message: "Sem permissao."
    });
  });

  assert.throws(() => {
    assertRole({
      usuario: { id: 2, role: "TECNICO" },
      roles: ["ADMIN"],
      message: "Sem permissao."
    });
  }, (error) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.statusCode, 403);
    assert.equal(error.message, "Sem permissao.");
    return true;
  });
});

test("requestParsers centraliza clamp, parse numerico, parse de id e boolean like", async () => {
  assert.equal(normalizeLimit(undefined), 10);
  assert.equal(normalizeLimit(0), 1);
  assert.equal(normalizeLimit(99), 20);
  assert.equal(normalizeLimit(7, 5, { min: 2, max: 8 }), 7);

  assert.equal(parseFiniteNumber("12.5"), 12.5);
  assert.equal(parseIntegerId("9"), 9);
  assert.equal(parseBooleanLike("true"), true);
  assert.equal(parseBooleanLike("false"), false);
  assert.equal(parseBooleanLike("qualquer", true), true);

  assert.throws(() => parseFiniteNumber("abc", "Numero invalido."), (error) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.statusCode, 400);
    assert.equal(error.message, "Numero invalido.");
    return true;
  });

  assert.throws(() => parseIntegerId("1.5", "Id invalido."), (error) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.statusCode, 400);
    assert.equal(error.message, "Id invalido.");
    return true;
  });
});

test("validateDestinatarios normaliza, deduplica e limita emails", async () => {
  const emails = validateDestinatarios([
    "ADMIN@orbis.local ",
    "admin@orbis.local",
    " tecnico@orbis.local "
  ], { max: 5 });

  assert.deepEqual(emails, [
    "admin@orbis.local",
    "tecnico@orbis.local"
  ]);
});

test("buildConfirmationSummaryText usa presenter compartilhado para envio de relatorio", async () => {
  const summaryText = buildConfirmationSummaryText({
    actionName: "enviar_relatorio_agora",
    actionLabel: "Enviar relatorio agora",
    summary: {
      nome: "Relatorio Semanal",
      emailsDestino: ["admin@orbis.local", "tecnico@orbis.local"],
      secoes: ["resumo", "sensores"]
    }
  });

  assert.equal(
    summaryText,
    "Vou enviar agora o relatorio Relatorio Semanal para admin@orbis.local, tecnico@orbis.local, usando as secoes resumo, sensores."
  );
});
