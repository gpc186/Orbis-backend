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
const DEFAULT_INTEGRITY_RECENT_WINDOW_DAYS = 7;
const DEFAULT_INTEGRITY_RECENT_START_PERCENT = 92;
const DEFAULT_INTEGRITY_CURVE_POWER = 1.15;
const DEFAULT_INTEGRITY_OSCILLATION_PERCENT = 0.9;
const DEFAULT_SENSOR_CURVE_POWER = 1.12;
const SEED_ALERT_MESSAGE_PREFIX = "[SEED_LEITURAS]";

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
    ),
    integrityRecentWindowDays: parsePositiveNumber(
      env.SEED_INTEGRIDADE_JANELA_RECENTE_DIAS,
      Math.min(DEFAULT_INTEGRITY_RECENT_WINDOW_DAYS, integrityDays)
    ),
    integrityRecentStartPercent: clamp(
      parseNonNegativeNumber(env.SEED_INTEGRIDADE_INICIO_JANELA_RECENTE_PERCENTUAL, DEFAULT_INTEGRITY_RECENT_START_PERCENT),
      0,
      100
    ),
    integrityCurvePower: parsePositiveNumber(env.SEED_INTEGRIDADE_CURVA_POTENCIA, DEFAULT_INTEGRITY_CURVE_POWER),
    integrityOscillationPercent: parseNonNegativeNumber(
      env.SEED_INTEGRIDADE_OSCILACAO_PERCENTUAL,
      DEFAULT_INTEGRITY_OSCILLATION_PERCENT
    ),
    sensorCurvePower: parsePositiveNumber(env.SEED_LEITURAS_CURVA_POTENCIA, DEFAULT_SENSOR_CURVE_POWER)
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

function easedProgress(progress, power = 1) {
  return Math.pow(clamp(progress, 0, 1), power);
}

function degradationProgress(progress, config) {
  return easedProgress(progress, config.sensorCurvePower);
}

function integrityTargetForProgress(progress, config) {
  const safeProgress = clamp(progress, 0, 1);
  const recentWindowRatio = clamp(config.integrityRecentWindowDays / config.integrityDays, 0.01, 1);
  const recentStartProgress = clamp(1 - recentWindowRatio, 0, 0.99);
  const finalPercent = clamp(config.integrityFinalPercent, 0, 100);
  const configuredRecentStartPercent = clamp(
    Math.max(config.integrityRecentStartPercent, finalPercent),
    finalPercent,
    100
  );
  const recentStartPercent = recentStartProgress === 0 ? 100 : configuredRecentStartPercent;

  if (safeProgress < recentStartProgress) {
    const earlyProgress = recentStartProgress > 0 ? safeProgress / recentStartProgress : 1;
    return 100 - ((100 - recentStartPercent) * easedProgress(earlyProgress, 0.85));
  }

  const recentProgress = (safeProgress - recentStartProgress) / (1 - recentStartProgress);
  const base = recentStartPercent - ((recentStartPercent - finalPercent) * easedProgress(
    recentProgress,
    config.integrityCurvePower
  ));
  const envelope = recentProgress * (1 - recentProgress);
  const oscillation = Math.sin((recentProgress * Math.PI * 6) + 0.35)
    * config.integrityOscillationPercent
    * envelope;

  return clamp(base + oscillation, finalPercent, 100);
}

function valueFromRange({ ideal, limit, progress, noisePercent, noiseFactor, allowLimitSpike, config }) {
  const safeIdeal = Number.isFinite(ideal) ? ideal : 0;
  const safeLimit = Number.isFinite(limit) && limit > safeIdeal ? limit : safeIdeal;
  const amplitude = Math.max(safeLimit - safeIdeal, 0);
  const finalSensorProgress = clamp((100 - integrityTargetForProgress(progress, config)) / 100, 0, 1);
  const baseProgress = allowLimitSpike ? 1.05 : finalSensorProgress;
  const base = safeIdeal + (amplitude * degradationProgress(progress, config) * baseProgress);
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
    const progress = progressForDate(cursor, start, end);
    const integridadeAlvo = integrityTargetForProgress(progress, config);
    const scores = sensors.map((sensor) => {
      const reading = buildReading(sensor, new Date(cursor), { start, end }, {
        ...config,
        createAlerts: false,
        noisePercent: 0
      });

      return calculateSensorHealth(sensor, reading);
    });
    const integridadeSensores = PredicaoService.calcularIntegridadeAgregada(scores);
    const integridade = round(clamp((integridadeAlvo * 0.72) + (integridadeSensores * 0.28), 0, 100));
    const stabilityPenalty = Math.abs(wave(maquinaId, cursor.getTime(), 2.4)) * config.integrityOscillationPercent;
    const scoreEstabilidade = round(clamp(integridade + 4 - stabilityPenalty, 35, 100));

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

function chooseSeedAlertTypes({ maquina, reading, sensor, integridade, criadoEm }) {
  const tipos = [];
  const temperatura = Number(reading?.temperatura);
  const vibracao = Number(reading?.vibracao);
  const limiteTemperatura = Number(sensor?.limiteTemperatura);
  const limiteVibracao = Number(sensor?.limiteVibracao);
  const idealTemperatura = Number(sensor?.idealTemperatura);
  const idealVibracao = Number(sensor?.idealVibracao);
  const desvioMaximoTemp = Number(sensor?.desvioMaximoTemp ?? 5);
  const desvioMaximoVibra = Number(sensor?.desvioMaximoVibra ?? 5);
  const hourBucket = Math.floor(criadoEm.getTime() / (60 * 60 * 1000));

  if (
    (Number.isFinite(temperatura) && Number.isFinite(limiteTemperatura) && temperatura > limiteTemperatura)
    || (Number.isFinite(vibracao) && Number.isFinite(limiteVibracao) && vibracao > limiteVibracao)
    || (maquina?.criticidade === "ALTA" && integridade <= 78 && hourBucket % 17 === 0)
  ) {
    tipos.push("LIMITE_ULTRAPASSADO");
  }

  if (
    Math.abs(temperatura - idealTemperatura) > desvioMaximoTemp
    || Math.abs(vibracao - idealVibracao) > desvioMaximoVibra
    || integridade <= 82
  ) {
    tipos.push("INSTABILIDADE");
  }

  if (integridade <= 88) {
    tipos.push("TENDENCIA_CURTA");
  }

  if (integridade <= 92) {
    tipos.push("TENDENCIA_LONGA");
  }

  return [...new Set(tipos)];
}

function buildSeedAlertRowsForMachine({ maquina, sensors, latestReadingsBySensor, historicoRows, config }) {
  const sensor = sensors[0];
  if (!sensor) return [];

  const latestReading = latestReadingsBySensor.get(sensor.id);
  if (!latestReading) return [];

  const rows = [];
  const checkpoints = historicoRows
    .filter((row) => row.maquinaId === maquina.id)
    .filter((row, index) => index % 16 === 0 || index === historicoRows.length - 1);

  for (const row of checkpoints) {
    const reading = buildReading(sensor, row.criadoEm, {
      start: historicoRows[0]?.criadoEm || row.criadoEm,
      end: historicoRows[historicoRows.length - 1]?.criadoEm || row.criadoEm
    }, {
      ...config,
      createAlerts: false
    });
    const tipos = chooseSeedAlertTypes({
      maquina,
      reading,
      sensor,
      integridade: row.integridade,
      criadoEm: row.criadoEm
    });

    for (const tipo of tipos) {
      rows.push({
        sensorId: sensor.id,
        maquinaId: maquina.id,
        tipo,
        status: tipo === "LIMITE_ULTRAPASSADO" ? "EM_ANDAMENTO" : "ATIVO",
        mensagem: `${SEED_ALERT_MESSAGE_PREFIX} ${tipo} sintetico para alimentar predicao e demonstracao.`,
        criadoEm: row.criadoEm
      });
    }
  }

  return rows;
}

async function getExistingSeedAlertKeys(maquinaIds, rangeStart) {
  const alertas = await prisma.alerta.findMany({
    where: {
      maquinaId: { in: maquinaIds },
      mensagem: { contains: SEED_ALERT_MESSAGE_PREFIX },
      criadoEm: { gte: rangeStart }
    },
    select: {
      maquinaId: true,
      tipo: true,
      criadoEm: true
    }
  });

  return new Set(alertas.map((alerta) => [
    alerta.maquinaId,
    alerta.tipo,
    new Date(alerta.criadoEm).toISOString().slice(0, 13)
  ].join(":")));
}

async function createSeedAlerts(alertRows, batchSize, rangeStart) {
  if (!alertRows.length) return 0;

  const maquinaIds = [...new Set(alertRows.map((row) => row.maquinaId))];
  const existingKeys = await getExistingSeedAlertKeys(maquinaIds, rangeStart);
  let created = 0;

  for (let index = 0; index < alertRows.length; index += batchSize) {
    const batch = alertRows.slice(index, index + batchSize);

    for (const row of batch) {
      const key = [row.maquinaId, row.tipo, row.criadoEm.toISOString().slice(0, 13)].join(":");
      if (existingKeys.has(key)) continue;

      const alerta = await prisma.alerta.create({
        data: row
      });

      await prisma.alertaEvento.create({
        data: {
          alertaId: alerta.id,
          tipo: "CRIADO",
          statusNovo: row.status,
          mensagem: row.mensagem,
          descricao: "Alerta sintetico criado pelo seed de leituras",
          criadoEm: row.criadoEm
        }
      });

      existingKeys.add(key);
      created += 1;
    }
  }

  return created;
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

function getLatestIntegrityRowsByMachine(rows) {
  const latestRows = new Map();

  for (const row of rows) {
    const current = latestRows.get(row.maquinaId);

    if (!current || row.criadoEm > current.criadoEm) {
      latestRows.set(row.maquinaId, row);
    }
  }

  return latestRows;
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

async function getLatestSeedIntegrityRow(maquinaId) {
  return await prisma.historicoIntegridade.findFirst({
    where: {
      maquinaId,
      origem: "SEED_LEITURAS"
    },
    orderBy: { criadoEm: "desc" },
    select: {
      maquinaId: true,
      integridade: true,
      scoreEstabilidade: true,
      criadoEm: true
    }
  });
}

async function updateSensorsAndMachines({ sensors, latestReadingsBySensor, latestHistoryByMachine, config }) {
  let updatedSensors = 0;
  let updatedMachines = 0;
  const historicoRows = [];
  const alertRows = [];

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
    return { updatedSensors, updatedMachines, historicoRows, createdAlerts: 0 };
  }

  const latestByMachine = groupLatestByMachine(sensors, latestReadingsBySensor);

  for (const [maquinaId, data] of latestByMachine.entries()) {
    const rows = buildIntegrityRowsForMachine({
      maquinaId,
      sensors: data.sensors,
      latestHistoryDate: latestHistoryByMachine.get(maquinaId),
      config
    });

    historicoRows.push(...rows);

    if (config.createAlerts) {
      alertRows.push(...buildSeedAlertRowsForMachine({
        maquina: data.maquina,
        sensors: data.sensors,
        latestReadingsBySensor,
        historicoRows: rows,
        config
      }));
    }
  }

  if (historicoRows.length > 0) {
    await createInBatches(prisma.historicoIntegridade, historicoRows, config.batchSize);
  }

  const createdAlerts = config.createAlerts
    ? await createSeedAlerts(
        alertRows,
        config.batchSize,
        alertRows[0]?.criadoEm || new Date(Date.now() - (7 * 24 * 60 * 60 * 1000))
      )
    : 0;

  const latestIntegrityRowsByMachine = getLatestIntegrityRowsByMachine(historicoRows);

  for (const maquinaId of latestByMachine.keys()) {
    const latestIntegrityRow = latestIntegrityRowsByMachine.get(maquinaId)
      || await getLatestSeedIntegrityRow(maquinaId);

    if (latestIntegrityRow) {
      await prisma.maquina.update({
        where: { id: maquinaId },
        data: {
          integridade: latestIntegrityRow.integridade,
          scoreEstabilidade: latestIntegrityRow.scoreEstabilidade
        }
      });
    }

    try {
      await PredicaoService.previsaoManutencao(maquinaId);
    } catch (error) {
      console.warn("seed_leituras_prediction_failed", {
        maquinaId,
        message: error.message
      });
    }

    updatedMachines += 1;
  }

  return { updatedSensors, updatedMachines, historicoRows, createdAlerts };
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
  const { updatedSensors, updatedMachines, historicoRows, createdAlerts } = await updateSensorsAndMachines({
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
    alertasCriados: createdAlerts,
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
  buildSeedAlertRowsForMachine,
  calculateSensorHealth,
  chooseSeedAlertTypes,
  degradationProgress,
  getLatestIntegrityRowsByMachine,
  getRange,
  integrityTargetForProgress,
  main,
  nextSeedStart,
  progressForDate
};
