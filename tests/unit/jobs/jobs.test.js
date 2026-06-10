const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");

const cron = require("node-cron");
const LeituraModel = require("../../../src/models/leituraModel");
const SensorModel = require("../../../src/models/sensorModel");
const RelatorioAgendamentoService = require("../../../src/services/relatorioAgendamentoService");
const AlertaService = require("../../../src/services/alertaService");
const MaquinaService = require("../../../src/services/maquinaService");
const leituraService = require("../../../src/services/leituraService");
const prisma = require("../../../src/prisma/prisma");
const logger = require("../../../src/utils/logger");
const { REPORT_TIMEZONE } = require("../../../src/utils/reportScheduleUtils");

const patches = [];
const originalEnv = { ...process.env };
const jobModules = [
  "../../../src/jobs/limpezaJob",
  "../../../src/jobs/relatorioJob",
  "../../../src/jobs/sensorOfflineJob",
  "../../../src/jobs/tendenciaJob",
  "../../../src/jobs/simuladorJob"
];
const [limpezaJob, relatorioJob, sensorOfflineJob, tendenciaJob, simuladorJob] = jobModules;

afterEach(() => {
  while (patches.length > 0) {
    const { target, key, original } = patches.pop();
    target[key] = original;
  }

  process.env = { ...originalEnv };

  for (const modulePath of jobModules) {
    delete require.cache[require.resolve(modulePath)];
  }
});

function patch(target, key, replacement) {
  patches.push({ target, key, original: target[key] });
  target[key] = replacement;
}

function importFresh(modulePath) {
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function captureCronSchedule() {
  const scheduled = [];

  patch(cron, "schedule", (expression, callback, options) => {
    const job = {
      expression,
      callback,
      options,
      stop() {}
    };

    scheduled.push(job);
    return job;
  });

  return scheduled;
}

function silenceLogger() {
  const logs = [];

  patch(logger, "info", (message, context) => logs.push({ level: "info", message, context }));
  patch(logger, "warn", (message, context) => logs.push({ level: "warn", message, context }));
  patch(logger, "error", (message, context) => logs.push({ level: "error", message, context }));

  return logs;
}

test("limpezaJob agenda limpeza diaria e remove leituras antigas", async () => {
  const scheduled = captureCronSchedule();
  const logs = silenceLogger();
  let dataRecebida = null;

  patch(LeituraModel, "limpeza", async (dataLimite) => {
    dataRecebida = dataLimite;
    return { count: 7 };
  });

  importFresh(limpezaJob);

  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].expression, "0 0 * * *");

  await scheduled[0].callback();

  assert.ok(dataRecebida instanceof Date);
  const diasAtras = (Date.now() - dataRecebida.getTime()) / (24 * 60 * 60 * 1000);
  assert.ok(diasAtras >= 29.9 && diasAtras <= 30.1);
  assert.ok(logs.some((log) => log.message === "limpeza_job_started"));
  assert.ok(logs.some((log) => log.message === "limpeza_job_finished" && log.context.leiturasDeletadas === 7));
});

test("relatorioJob so agenda quando habilitado e processa agendamentos vencidos", async () => {
  process.env.REPORT_JOB_ENABLED = "true";
  process.env.REPORT_JOB_CRON = "*/10 * * * *";

  const scheduled = captureCronSchedule();
  const logs = silenceLogger();

  patch(RelatorioAgendamentoService, "processDueSchedules", async () => [
    { id: 1 },
    { id: 2 }
  ]);

  importFresh(relatorioJob);

  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].expression, "*/10 * * * *");
  assert.deepEqual(scheduled[0].options, { timezone: REPORT_TIMEZONE });
  assert.ok(logs.some((log) => log.message === "relatorio_job_started"));

  await scheduled[0].callback();

  assert.ok(logs.some((log) => log.message === "relatorio_job_finished" && log.context.processedCount === 2));
});

test("sensorOfflineJob respeita flag de ambiente e atualiza sensores vencidos quando habilitado", async () => {
  process.env.SENSOR_OFFLINE_JOB_ENABLED = "false";
  process.env.SENSOR_OFFLINE_INTERVAL_SECONDS = "30";

  const scheduled = captureCronSchedule();
  const logs = silenceLogger();

  importFresh(sensorOfflineJob);

  assert.equal(scheduled.length, 0);
  assert.ok(logs.some((log) => log.message === "sensor_offline_job_disabled"));

  process.env.SENSOR_OFFLINE_JOB_ENABLED = "true";
  delete require.cache[require.resolve(sensorOfflineJob)];

  let limiteRecebido = null;
  patch(SensorModel, "updateStatus", async (limiteOffline) => {
    limiteRecebido = limiteOffline;
    return { count: 3 };
  });

  importFresh(sensorOfflineJob);

  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].expression, "*/5 * * * * *");

  await scheduled[0].callback();

  assert.ok(limiteRecebido instanceof Date);
  const segundosAtras = (Date.now() - limiteRecebido.getTime()) / 1000;
  assert.ok(segundosAtras >= 29 && segundosAtras <= 31);
  assert.ok(logs.some((log) => log.message === "sensor_offline_job_finished" && log.context.sensoresAtualizados === 3));
});

test("simuladorJob degrada maquinas linearmente pelas specs dos sensores", async () => {
  process.env.SIMULADOR_JOB_ATIVO = "true";
  process.env.SIMULADOR_INTERVALO_MS = "60000";
  process.env.SIMULADOR_DEGRADACAO_HORAS = "1";
  process.env.SIMULADOR_RUIDO_PERCENTUAL = "0";
  process.env.SIMULADOR_FORCAR_ALERTAS = "false";

  silenceLogger();

  const leituras = [];

  patch(prisma.sensor, "findMany", async () => [
    {
      id: 1,
      maquinaId: 10,
      status: "ONLINE",
      idealTemperatura: 60,
      limiteTemperatura: 90,
      desvioMaximoTemp: 20,
      idealVibracao: 5,
      limiteVibracao: 11,
      desvioMaximoVibra: 4,
      maquina: { id: 10, nome: "Prensa" }
    },
    {
      id: 2,
      maquinaId: 10,
      status: "ONLINE",
      idealTemperatura: 40,
      limiteTemperatura: 70,
      desvioMaximoTemp: 20,
      idealVibracao: 2,
      limiteVibracao: 8,
      desvioMaximoVibra: 4,
      maquina: { id: 10, nome: "Prensa" }
    },
    {
      id: 3,
      maquinaId: 20,
      status: "ONLINE",
      idealTemperatura: 50,
      limiteTemperatura: 80,
      desvioMaximoTemp: 20,
      idealVibracao: 3,
      limiteVibracao: 9,
      desvioMaximoVibra: 4,
      maquina: { id: 20, nome: "Torno" }
    }
  ]);

  patch(leituraService, "processarNovaLeitura", async (payload) => {
    leituras.push(payload);
    return { id: leituras.length, ...payload };
  });

  const simulador = importFresh(simuladorJob);

  await simulador.simularCiclo();
  await simulador.simularCiclo();
  simulador.resetarMaquinaSimulada(10);
  await simulador.simularCiclo();

  assert.equal(leituras.length, 9);
  assert.deepEqual(leituras.slice(0, 3), [
    { sensorId: 1, temperatura: 60, vibracao: 5 },
    { sensorId: 2, temperatura: 40, vibracao: 2 },
    { sensorId: 3, temperatura: 50, vibracao: 3 }
  ]);
  assert.deepEqual(leituras.slice(3, 6), [
    { sensorId: 1, temperatura: 60.5, vibracao: 5.1 },
    { sensorId: 2, temperatura: 40.5, vibracao: 2.1 },
    { sensorId: 3, temperatura: 50.5, vibracao: 3.1 }
  ]);
  assert.deepEqual(leituras.slice(6), [
    { sensorId: 1, temperatura: 60, vibracao: 5 },
    { sensorId: 2, temperatura: 40, vibracao: 2 },
    { sensorId: 3, temperatura: 51, vibracao: 3.2 }
  ]);
});

test("tendenciaJob nao consulta banco fora de producao", async () => {
  process.env.NODE_ENV = "TEST";

  const scheduled = captureCronSchedule();
  silenceLogger();

  patch(prisma.sensor, "findMany", async () => {
    throw new Error("nao deveria consultar sensores fora de producao");
  });

  importFresh(tendenciaJob);

  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].expression, "*/30 * * * *");

  await scheduled[0].callback();
});

test("tendenciaJob em producao gera alertas e penaliza maquina quando medias sobem", async () => {
  process.env.NODE_ENV = "PRODUCTION";

  const scheduled = captureCronSchedule();
  const logs = silenceLogger();
  const alertas = [];
  const updates = [];
  const medias = [20, 10, 8];

  patch(prisma.sensor, "findMany", async () => [
    { id: 5, maquinaId: 9, status: "ONLINE", maquina: { id: 9, nome: "Prensa" } }
  ]);
  patch(prisma.leitura, "aggregate", async () => ({
    _avg: { vibracao: medias.shift() }
  }));
  patch(AlertaService, "gerarAlerta", async (sensorId, maquinaId, tipo, mensagem) => {
    alertas.push({ sensorId, maquinaId, tipo, mensagem });
  });
  patch(MaquinaService, "update", async (maquinaId, dados) => {
    updates.push({ maquinaId, dados });
  });

  importFresh(tendenciaJob);

  await scheduled[0].callback();

  assert.deepEqual(alertas.map((alerta) => alerta.tipo), ["TENDENCIA_CURTA", "TENDENCIA_LONGA"]);
  assert.deepEqual(updates, [
    {
      maquinaId: 9,
      dados: {
        scoreEstabilidade: { decrement: 5 },
        integridade: { decrement: 2 }
      }
    },
    {
      maquinaId: 9,
      dados: {
        scoreEstabilidade: { decrement: 3 },
        integridade: { decrement: 1 }
      }
    }
  ]);
  assert.ok(logs.some((log) => log.message === "tendencia_job_finished" && log.context.alertasGerados === 2));
});
