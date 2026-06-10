const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");

const AppError = require("../../../src/utils/appErrorUtils");
const { validateContactPayload } = require("../../../src/utils/contactValidation");
const {
  cleanText,
  isValidEmail,
  normalizeEmails,
  validateContatoPayload
} = require("../../../src/utils/emailValidation");
const {
  generateAccessToken,
  generateRefreshTokenData,
  verifyAccessToken
} = require("../../../src/utils/jwtUtils");
const normalizeQuestion = require("../../../src/utils/normalizeQuestion");
const {
  buildScheduleDescription,
  computeNextRun,
  formatReportDateTime,
  REPORT_TIMEZONE
} = require("../../../src/utils/reportScheduleUtils");
const {
  calculateScheduleCompliance,
  normalizePriority,
  normalizeTitle
} = require("../../../src/utils/manutencaoScheduleUtils");
const {
  validateAgendamento,
  validateFiltros,
  validatePeriodo,
  validatePreviewPayload,
  validateSchedulePayload,
  validateStatusPayload
} = require("../../../src/utils/reportValidation");
const validarEnv = require("../../../src/utils/validarEnv");

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

test("contactValidation normaliza payload publico e rejeita headers maliciosos", () => {
  const result = validateContactPayload({
    nome: "  Gustavo   Silva  ",
    email: "GUSTAVO@EXAMPLE.COM",
    assunto: "Contato",
    mensagem: "Mensagem valida para contato."
  });

  assert.deepEqual(result, {
    ok: true,
    data: {
      nome: "Gustavo Silva",
      email: "gustavo@example.com",
      assunto: "Contato",
      mensagem: "Mensagem valida para contato."
    }
  });

  const invalid = validateContactPayload({
    nome: "Gustavo",
    email: "gustavo@example.com",
    assunto: "Contato\r\nBCC: attacker@example.com",
    mensagem: "Mensagem valida para contato."
  });

  assert.equal(invalid.ok, false);
  assert.equal(invalid.status, 400);
});

test("emailValidation limpa textos, deduplica emails e valida payload de contato", () => {
  assert.equal(cleanText("  oi\t\tmundo\u0000 "), "oi mundo");
  assert.equal(isValidEmail("admin@orbis.local"), true);
  assert.equal(isValidEmail("admin@orbis"), false);
  assert.deepEqual(normalizeEmails(["ADMIN@orbis.local ", "admin@orbis.local"]), ["admin@orbis.local"]);

  const payload = validateContatoPayload({
    nome: "Ana",
    email: "ANA@ORBIS.LOCAL",
    assunto: "Ajuda",
    mensagem: "Mensagem suficientemente grande."
  });

  assert.deepEqual(payload, {
    nome: "Ana",
    email: "ana@orbis.local",
    assunto: "Ajuda",
    mensagem: "Mensagem suficientemente grande."
  });

  assert.throws(() => {
    validateContatoPayload({
      nome: "A",
      email: "ana@orbis.local",
      assunto: "Ajuda",
      mensagem: "Mensagem suficientemente grande."
    });
  }, AppError);

  assert.throws(() => {
    validateContatoPayload({
      nome: "Ana",
      email: "ana@orbis.local",
      assunto: "Ajuda\r\nBCC: atacante@orbis.local",
      mensagem: "Mensagem suficientemente grande."
    });
  }, AppError);
});

test("jwtUtils gera access token verificavel e refresh token hexadecimal com expiracao", () => {
  process.env.JWT_SECRET = "jwt-test-secret";
  process.env.JWT_EXPIRES_IN = "1h";
  process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS = "3";

  const accessToken = generateAccessToken({ id: 7, role: "ADMIN" });
  const decoded = verifyAccessToken(accessToken);

  assert.equal(decoded.id, 7);
  assert.equal(decoded.role, "ADMIN");

  const before = Date.now();
  const refresh = generateRefreshTokenData();
  const after = Date.now();

  assert.equal(refresh.token.length, 128);
  assert.match(refresh.token, /^[a-f0-9]+$/);
  assert.ok(refresh.expiresAt.getTime() >= before + 3 * 24 * 60 * 60 * 1000 - 1000);
  assert.ok(refresh.expiresAt.getTime() <= after + 3 * 24 * 60 * 60 * 1000 + 1000);
});

test("normalizeQuestion limita tamanho e remove controles preservando quebras uteis", () => {
  const result = normalizeQuestion("  pergunta\t\tcom   espaços\n\n\n\nlinha\u0007 final  ", 28);

  assert.equal(result.original, "  pergunta\t\tcom   espaços\n\n\n\nlinha\u0007 final  ");
  assert.equal(result.normalized, "pergunta com espaços\n\nlinha");
});

test("reportScheduleUtils calcula proximas execucoes e descricoes no timezone configurado", () => {
  assert.equal(REPORT_TIMEZONE, "America/Sao_Paulo");

  const now = new Date("2026-06-05T13:00:00.000Z");
  const daily = computeNextRun({ frequencia: "DIARIO", hora: 10, minuto: 30 }, now);
  const weekly = computeNextRun({ frequencia: "SEMANAL", diaSemana: 5, hora: 9, minuto: 0 }, now);
  const monthly = computeNextRun({ frequencia: "MENSAL", diaMes: 31, hora: 8, minuto: 0 }, new Date("2026-02-01T12:00:00.000Z"));

  assert.equal(daily.toISOString(), "2026-06-05T13:30:00.000Z");
  assert.equal(weekly.toISOString(), "2026-06-12T12:00:00.000Z");
  assert.equal(monthly.toISOString(), "2026-02-28T11:00:00.000Z");
  assert.equal(formatReportDateTime("2026-06-05T13:30:00.123Z"), "2026-06-05T10:30:00.123+03:00");
  assert.equal(buildScheduleDescription({ frequencia: "SEMANAL", diaSemana: 5, hora: 9, minuto: 5 }), "Semanal toda Sexta as 09:05");
});

test("manutencaoScheduleUtils calcula cumprimento por dia de conclusao", () => {
  assert.deepEqual(calculateScheduleCompliance({
    dataAgendada: "2026-06-20T10:00:00.000Z",
    concluidaEm: "2026-06-20T22:00:00.000Z",
    status: "RESOLVIDO"
  }), {
    cumprimentoAgendamento: "NO_PRAZO",
    diasDesvioAgendamento: 0
  });

  assert.deepEqual(calculateScheduleCompliance({
    dataAgendada: "2026-06-20T10:00:00.000Z",
    concluidaEm: "2026-06-18T22:00:00.000Z",
    status: "RESOLVIDO"
  }), {
    cumprimentoAgendamento: "ANTECIPADA",
    diasDesvioAgendamento: -2
  });

  assert.deepEqual(calculateScheduleCompliance({
    dataAgendada: "2026-06-20T10:00:00.000Z",
    concluidaEm: "2026-06-22T22:00:00.000Z",
    status: "RESOLVIDO"
  }), {
    cumprimentoAgendamento: "ATRASADA",
    diasDesvioAgendamento: 2
  });

  assert.deepEqual(calculateScheduleCompliance({
    dataAgendada: "2026-06-20T10:00:00.000Z",
    concluidaEm: null,
    status: "AGENDADA"
  }), {
    cumprimentoAgendamento: "NAO_APLICAVEL",
    diasDesvioAgendamento: null
  });

  assert.equal(normalizePriority("urgente"), "URGENTE");
  assert.equal(normalizePriority("x"), null);
  assert.equal(normalizeTitle("  Revisao  ", "fallback"), "Revisao");
});

test("reportValidation normaliza periodo, filtros, preview, status e agendamento", () => {
  assert.deepEqual(validatePeriodo({ tipo: "relative_days", valor: "15" }), {
    tipo: "RELATIVE_DAYS",
    valor: 15
  });
  assert.deepEqual(validateFiltros({
    maquinasIds: ["1", "abc", "2"],
    sensoresIds: [3, -1],
    usuariosIds: ["4"],
    secoes: ["resumo", "sensores", "resumo"]
  }), {
    maquinasIds: [1, 2],
    sensoresIds: [3],
    usuariosIds: [4],
    secoes: ["resumo", "sensores"]
  });
  assert.deepEqual(validateAgendamento({
    frequencia: "semanal",
    hora: "8",
    minuto: "30",
    diaSemana: "2"
  }), {
    frequencia: "SEMANAL",
    hora: 8,
    minuto: 30,
    diaSemana: 2,
    diaMes: null
  });
  assert.deepEqual(validateStatusPayload({ status: "pausado" }), { status: "PAUSADO" });
  assert.deepEqual(validatePreviewPayload({ assunto: "Resumo", periodo: { valor: 7 }, filtros: {} }).periodo, {
    tipo: "RELATIVE_DAYS",
    valor: 7
  });

  const schedule = validateSchedulePayload({
    nome: "Relatorio semanal",
    emailsDestino: "ADMIN@orbis.local, tecnico@orbis.local",
    periodo: { tipo: "CUSTOM_RANGE", inicio: "2026-06-01", fim: "2026-06-05" },
    filtros: { secoes: ["resumo"] },
    agendamento: { frequencia: "DIARIO", hora: 8, minuto: 0 }
  });

  assert.deepEqual(schedule.emailsDestino, ["admin@orbis.local", "tecnico@orbis.local"]);
  assert.equal(schedule.periodo.tipo, "CUSTOM_RANGE");
  assert.deepEqual(schedule.filtros.secoes, ["resumo"]);
});

test("reportValidation rejeita payloads invalidos com AppError", () => {
  assert.throws(() => validatePeriodo({ tipo: "CUSTOM_RANGE", inicio: "2026-06-05", fim: "2026-06-01" }), AppError);
  assert.throws(() => validateFiltros({ secoes: ["inexistente"] }), AppError);
  assert.throws(() => validateAgendamento({ frequencia: "MENSAL", hora: 8, diaMes: 40 }), AppError);
  assert.throws(() => validateStatusPayload({ status: "INVALIDO" }), AppError);
});

test("validarEnv exige variaveis obrigatorias", () => {
  process.env = {};

  assert.throws(() => validarEnv(), /DATABASE_URL/);

  process.env = {
    DATABASE_URL: "postgresql://example",
    JWT_SECRET: "secret",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE: "service-role",
    ESP32_API_KEY: "esp"
  };

  assert.doesNotThrow(() => validarEnv());
});
