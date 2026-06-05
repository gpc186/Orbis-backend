const { afterEach, beforeEach, test } = require("node:test");
const assert = require("node:assert/strict");

const ReadinessService = require("../../../src/services/readinessService");

const originalEnv = {
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  GROQ_MODEL: process.env.GROQ_MODEL,
  REPORT_JOB_CRON: process.env.REPORT_JOB_CRON,
  REPORT_JOB_ENABLED: process.env.REPORT_JOB_ENABLED,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
  SIMULADOR_INTERVALO_MS: process.env.SIMULADOR_INTERVALO_MS,
  SIMULADOR_JOB_ATIVO: process.env.SIMULADOR_JOB_ATIVO
};

const originalCheckDatabase = ReadinessService.checkDatabase;

function restoreEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

beforeEach(() => {
  restoreEnv();
  ReadinessService.checkDatabase = originalCheckDatabase;
});

afterEach(() => {
  restoreEnv();
  ReadinessService.checkDatabase = originalCheckDatabase;
});

test("checkEmail retorna configured quando Resend esta completo", () => {
  process.env.RESEND_API_KEY = "resend-key";
  process.env.RESEND_FROM_EMAIL = "orbis@example.com";

  assert.deepEqual(ReadinessService.checkEmail(), { status: "configured" });
});

test("checkEmail lista variaveis ausentes quando Resend esta incompleto", () => {
  delete process.env.RESEND_API_KEY;
  process.env.RESEND_FROM_EMAIL = "orbis@example.com";

  assert.deepEqual(ReadinessService.checkEmail(), {
    status: "misconfigured",
    missing: ["RESEND_API_KEY"]
  });
});

test("checkAi usa modelo configurado ou fallback padrao", () => {
  process.env.GROQ_API_KEY = "groq-key";
  delete process.env.GROQ_MODEL;

  assert.deepEqual(ReadinessService.checkAi(), {
    status: "configured",
    model: "llama-3.3-70b-versatile"
  });

  process.env.GROQ_MODEL = "custom-model";

  assert.deepEqual(ReadinessService.checkAi(), {
    status: "configured",
    model: "custom-model"
  });
});

test("checkJobs normaliza flags e aplica defaults operacionais", () => {
  process.env.REPORT_JOB_ENABLED = "TRUE";
  process.env.REPORT_JOB_CRON = "*/5 * * * *";
  process.env.SIMULADOR_JOB_ATIVO = "false";
  process.env.SIMULADOR_INTERVALO_MS = "abc";

  const jobs = ReadinessService.checkJobs();

  assert.equal(jobs.relatorio.status, "enabled");
  assert.equal(jobs.relatorio.cron, "*/5 * * * *");
  assert.equal(jobs.relatorio.timezone, "America/Sao_Paulo");
  assert.equal(jobs.simulador.status, "disabled");
  assert.equal(jobs.simulador.intervalMs, 5000);
});

test("check combina dependencias e sinaliza servico pronto", async () => {
  process.env.RESEND_API_KEY = "resend-key";
  process.env.RESEND_FROM_EMAIL = "orbis@example.com";
  process.env.GROQ_API_KEY = "groq-key";
  ReadinessService.checkDatabase = async () => ({ status: "up" });

  const result = await ReadinessService.check();

  assert.equal(result.ok, true);
  assert.equal(result.services.database.status, "up");
  assert.equal(result.services.email.status, "configured");
  assert.equal(result.services.ai.status, "configured");
  assert.match(result.time, /^\d{4}-\d{2}-\d{2}T/);
});

test("check marca ok false quando dependencia obrigatoria falha", async () => {
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM_EMAIL;
  process.env.GROQ_API_KEY = "groq-key";
  ReadinessService.checkDatabase = async () => ({ status: "down", reason: "database_unreachable" });

  const result = await ReadinessService.check();

  assert.equal(result.ok, false);
  assert.equal(result.services.database.status, "down");
  assert.equal(result.services.email.status, "misconfigured");
});
