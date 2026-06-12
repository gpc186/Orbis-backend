require("../src/config/env")();

const prisma = require("../src/prisma/prisma");
const PredicaoService = require("../src/services/predicaoService");

const DEFAULT_DAYS = 7;
const DEFAULT_INTERVAL_MINUTES = 5;
const DEFAULT_BATCH_SIZE = 1000;
const DEFAULT_MAX_READINGS_PER_SENSOR = 5000;
const DEFAULT_NOISE_PERCENT = 0.015;
const DEFAULT_ENSURE_CURRENT_READING = true;
const DEFAULT_INTEGRITY_DAYS = 30;
const DEFAULT_INTEGRITY_INTERVAL_MINUTES = 30;
const DEFAULT_INTEGRITY_FINAL_PERCENT = 70;

function parsePositiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseNonNegativeNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseBoolean(value, fallback = false) {
  if (value === undefined) return fallback;
  return String(value).toLowerCase() === "true";
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function round(value) {
  return Number(value.toFixed(2));
}

function buildConfig(env = process.env) {
  const days = parsePositiveNumber(env.SEED_LEITURAS_DIAS, DEFAULT_DAYS);
  const intervalMinutes = parsePositiveNumber(env.SEED_LEITURAS_INTERVALO_MINUTOS, DEFAULT_INTERVAL_MINUTES);
  const integrityDays = parsePositiveNumber(env.SEED_INTEGRIDADE_DIAS_DEGRADACAO, DEFAULT_INTEGRITY_DAYS);
  const integrityIntervalMinutes = parsePositiveNumber(
    env.SEED_INTEGRIDADE_INTERVALO_MINUTOS,
    DEFAULT_INTEGRITY_INTERVAL_MINUTES
  );

  return {
    days,
    intervalMinutes,
    intervalMs: intervalMinutes * 60 * 1000,
    batchSize: Math.floor(parsePositiveNumber(env.SEED_LEITURAS_BATCH_SIZE, DEFAULT_BATCH_SIZE)),
    maxReadingsPerSensor: Math.floor(parsePositiveNumber(
      env.SEED_LEITURAS_MAX_POR_SENSOR,
      DEFAULT_MAX_READINGS_PER_SENSOR
    )),
    noisePercent: parseNonNegativeNumber(env.SEED_LEITURAS_RUIDO_PERCENTUAL, DEFAULT_NOISE_PERCENT),
    createAlerts: parseBoolean(env.SEED_LEITURAS_CRIAR_ALERTAS, false),
    updateMachines: parseBoolean(env.SEED_LEITURAS_ATUALIZAR_MAQUINAS, true),
    ensureCurrentReading: parseBoolean(env.SEED_LEITURAS_GARANTIR_LEITURA_ATUAL, DEFAULT_ENSURE_CURRENT_READING),
    integrityDays,
    integrityIntervalMinutes,
    integrityIntervalMs: integrityIntervalMinutes * 60 * 1000,
    integrityFinalPercent: clamp(
      parseNonNegativeNumber(env.SEED_INTEGRIDADE_FINAL_PERCENTUAL, DEFAULT_INTEGRITY_FINAL_PERCENT),
      0,
      100
    )
  };
}

function getRange(config, now = new Date()) {
  const end = now;
  const start = new Date(end.getTime() - (config.days * 24 * 60 * 60 * 1000));
  return { start, end };
}

function progressForDate(date, start, end) {
  const totalMs = end.getTime() - start.getTime();
  if (totalMs <= 0) return 0;
  return clamp((date.getTime() - start.getTime()) / totalMs, 0, 1);
}

function wave(sensorId, timestamp, multiplier = 1) {
  const minutes = Math.floor(timestamp / 60000);
  return Math.sin((minutes / 17) + (sensorId * 1.37) + multiplier);
}

function valueFromRange({ ideal, limit, progress, noisePercent, noiseFactor, allowLimitSpike, config }) {
  const safeIdeal = Number.isFinite(ideal) ? ideal : 0;
  const safeLimit = Number.isFinite(limit) && limit > safeIdeal ? limit : safeIdeal;
  const amplitude = Math.max(safeLimit - safeIdeal, 0);
  const finalSensorProgress = clamp((100 - config.integrityFinalPercent) / 100, 0, 1);
  const baseProgress = allowLimitSpike ? 1.05 : finalSensorProgress;
  const base = safeIdeal + (amplitude * progress * baseProgress);
  const noise = amplitude * noisePercent * noiseFactor;

  return round(clamp(base + noise, safeIdeal, allowLimitSpike ? safeLimit * 1.12 : safeLimit));
}

function shouldCreateSpike(sensor, date, config) {
  if (!config.createAlerts) return false;

  const hourBucket = Math.floor(date.getTime() / (60 * 60 * 1000));
  return sensor.maquina?.criticidade === "ALTA" && (hourBucket + sensor.id) % 37 === 0;
}

function buildReading(sensor, date, range, config) {
  const progress = progressForDate(date, range.start, range.end);
  const spike = shouldCreateSpike(sensor, date, config);

  return {
    sensorId: sensor.id,
    temperatura: valueFromRange({
      ideal: Number(sensor.idealTemperatura),
      limit: Number(sensor.limiteTemperatura),
      progress,
      noisePercent: config.noisePercent,
      noiseFactor: wave(sensor.id, date.getTime(), 0.3),
      allowLimitSpike: spike,
      config
    }),
    vibracao: valueFromRange({
      ideal: Number(sensor.idealVibracao),
      limit: Number(sensor.limiteVibracao),
      progress,
      noisePercent: config.noisePercent,
      noiseFactor: wave(sensor.id, date.getTime(), 1.1),
      allowLimitSpike: spike,
      config
    }),
    criadoEm: date
  };
}

function nextSeedStart({ latestReadingDate, rangeStart, intervalMs }) {
  if (!latestReadingDate) return rangeStart;

  const latest = latestReadingDate instanceof Date ? latestReadingDate : new Date(latestReadingDate);
  if (Number.isNaN(latest.getTime())) return rangeStart;

  return new Date(Math.max(rangeStart.getTime(), latest.getTime() + intervalMs));
}

function buildReadingsForSensor(sensor, latestReadingDate, range, config) {
  const readings = [];
  let cursor = nextSeedStart({
    latestReadingDate,
    rangeStart: range.start,
    intervalMs: config.intervalMs
  });

  while (cursor <= range.end && readings.length < config.maxReadingsPerSensor) {
    readings.push(buildReading(sensor, new Date(cursor), range, config));
    cursor = new Date(cursor.getTime() + config.intervalMs);
  }

  const lastReading = readings[readings.length - 1];
  const shouldAppendCurrentReading = config.ensureCurrentReading && (
    !lastReading ||
    lastReading.criadoEm.getTime() < range.end.getTime()
  );

  if (shouldAppendCurrentReading && readings.length < config.maxReadingsPerSensor) {
    readings.push(buildReading(sensor, new Date(range.end), range, config));
  }

  return readings;
}

async function getLatestReadingsBySensor(sensorIds) {
  const latestRows = await prisma.leitura.groupBy({
    by: ["sensorId"],
    where: {
      sensorId: { in: sensorIds }
    },
    _max: {
      criadoEm: true
    }
  });

  return new Map(latestRows.map((row) => [row.sensorId, row._max.criadoEm]));
}

async function createInBatches(model, rows, batchSize) {
  let created = 0;

  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    const result = await model.createMany({ data: batch });
    created += result.count;
  }

  return created;
}

function calculateSensorHealth(sensor, reading) {
  return PredicaoService.calcularHealthScore({
    ...sensor,
    temperatura: reading.temperatura,
    vibracao: reading.vibracao
  });
}

function buildIntegrityRowsForMachine({
  maquinaId,
  sensors,
  latestHistoryDate,
  config,
  now = new Date()
}) {
  const rows = [];
  const end = now;
  const start = new Date(end.getTime() - (config.integrityDays * 24 * 60 * 60 * 1000));
  let cursor = nextSeedStart({
    latestReadingDate: latestHistoryDate,
    rangeStart: start,
    intervalMs: config.integrityIntervalMs
  });

  while (cursor < end) {
    const scores = sensors.map((sensor) => {
      const reading = buildReading(sensor, new Date(cursor), { start, end }, {
        ...config,
        createAlerts: false,
        noisePercent: 0
      });

      return calculateSensorHealth(sensor, reading);
    });
    const integridade = PredicaoService.calcularIntegridadeAgregada(scores);
    const scoreEstabilidade = round(clamp(integridade + 5, 35, 100));

    rows.push({
      maquinaId,
      integridade,
      scoreEstabilidade,
      origem: "SEED_LEITURAS",
      observacao: "Historico gerado pelo seed de leituras para demonstracao.",
      criadoEm: new Date(cursor)
    });

    cursor = new Date(cursor.getTime() + config.integrityIntervalMs);
  }

  return rows;
}

function groupLatestByMachine(sensors, latestReadingsBySensor) {
  const machines = new Map();

  for (const sensor of sensors) {
    const reading = latestReadingsBySensor.get(sensor.id);
    if (!reading) continue;

    if (!machines.has(sensor.maquinaId)) {
      machines.set(sensor.maquinaId, {
        maquina: sensor.maquina,
        sensors: [],
        healthScores: []
      });
    }

    machines.get(sensor.maquinaId).sensors.push(sensor);
    machines.get(sensor.maquinaId).healthScores.push(calculateSensorHealth(sensor, reading));
  }

  return machines;
}

async function getLatestHistoryByMachine(maquinaIds) {
  const latestRows = await prisma.historicoIntegridade.groupBy({
    by: ["maquinaId"],
    where: {
      maquinaId: { in: maquinaIds }
    },
    _max: {
      criadoEm: true
    }
  });

  return new Map(latestRows.map((row) => [row.maquinaId, row._max.criadoEm]));
}

async function updateSensorsAndMachines({ sensors, latestReadingsBySensor, latestHistoryByMachine, config }) {
  let updatedSensors = 0;
  let updatedMachines = 0;
  const historicoRows = [];

  for (const sensor of sensors) {
    const latestReading = latestReadingsBySensor.get(sensor.id);
    if (!latestReading) continue;

    await prisma.sensor.update({
      where: { id: sensor.id },
      data: {
        status: "ONLINE",
        ultimaTemperatura: latestReading.temperatura,
        ultimaVibracao: latestReading.vibracao,
        ultimaLeituraEm: latestReading.criadoEm
      }
    });
    updatedSensors += 1;
  }

  if (!config.updateMachines) {
    return { updatedSensors, updatedMachines, historicoRows };
  }

  const latestByMachine = groupLatestByMachine(sensors, latestReadingsBySensor);

  for (const [maquinaId, data] of latestByMachine.entries()) {
    historicoRows.push(...buildIntegrityRowsForMachine({
      maquinaId,
      sensors: data.sensors,
      latestHistoryDate: latestHistoryByMachine.get(maquinaId),
      config
    }));

    await PredicaoService.atualizarSaudeMaquina(maquinaId);
    await PredicaoService.previsaoManutencao(maquinaId);
    updatedMachines += 1;
  }

  if (historicoRows.length > 0) {
    await createInBatches(prisma.historicoIntegridade, historicoRows, config.batchSize);
  }

  return { updatedSensors, updatedMachines, historicoRows };
}

async function main() {
  const config = buildConfig();
  const range = getRange(config);

  const sensors = await prisma.sensor.findMany({
    where: { status: { not: "INATIVO" } },
    include: {
      maquina: {
        select: {
          id: true,
          nome: true,
          criticidade: true
        }
      }
    },
    orderBy: { id: "asc" }
  });

  if (sensors.length === 0) {
    console.log("seed_leituras_no_sensors");
    return;
  }

  const latestDatesBySensor = await getLatestReadingsBySensor(sensors.map((sensor) => sensor.id));
  const allReadings = [];
  const latestReadingsBySensor = new Map();

  for (const sensor of sensors) {
    const readings = buildReadingsForSensor(sensor, latestDatesBySensor.get(sensor.id), range, config);
    allReadings.push(...readings);

    if (readings.length > 0) {
      latestReadingsBySensor.set(sensor.id, readings[readings.length - 1]);
    }
  }

  const createdReadings = await createInBatches(prisma.leitura, allReadings, config.batchSize);
  const maquinaIds = [...new Set(sensors.map((sensor) => sensor.maquinaId))];
  const latestHistoryByMachine = await getLatestHistoryByMachine(maquinaIds);
  const { updatedSensors, updatedMachines, historicoRows } = await updateSensorsAndMachines({
    sensors,
    latestReadingsBySensor,
    latestHistoryByMachine,
    config
  });

  console.log("seed_leituras_finished", {
    sensores: sensors.length,
    leiturasCriadas: createdReadings,
    sensoresAtualizados: updatedSensors,
    maquinasAtualizadas: updatedMachines,
    historicosCriados: historicoRows.length,
    periodoInicio: range.start.toISOString(),
    periodoFim: range.end.toISOString(),
    intervaloMinutos: config.intervalMinutes,
    integridadeDiasDegradacao: config.integrityDays,
    integridadeIntervaloMinutos: config.integrityIntervalMinutes,
    integridadeFinalPercentual: config.integrityFinalPercent
  });
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error("seed_leituras_failed", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = {
  buildConfig,
  buildIntegrityRowsForMachine,
  buildReading,
  buildReadingsForSensor,
  calculateSensorHealth,
  getRange,
  nextSeedStart,
  progressForDate
};
