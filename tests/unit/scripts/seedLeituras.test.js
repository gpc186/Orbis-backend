const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  buildConfig,
  buildIntegrityRowsForMachine,
  buildReading,
  buildReadingsForSensor,
  calculateSensorHealth,
  nextSeedStart,
  progressForDate
} = require("../../../scripts/seed-leituras");

const sensor = {
  id: 4,
  maquinaId: 2,
  tipo: "Vibracao",
  idealTemperatura: 40,
  limiteTemperatura: 80,
  idealVibracao: 2,
  limiteVibracao: 10,
  maquina: {
    id: 2,
    nome: "Prensa",
    criticidade: "ALTA"
  }
};

test("seed leituras normaliza configuracao com defaults seguros", () => {
  const config = buildConfig({
    SEED_LEITURAS_DIAS: "3",
    SEED_LEITURAS_INTERVALO_MINUTOS: "15",
    SEED_LEITURAS_BATCH_SIZE: "200",
    SEED_LEITURAS_CRIAR_ALERTAS: "true",
    SEED_INTEGRIDADE_DIAS_DEGRADACAO: "30",
    SEED_INTEGRIDADE_INTERVALO_MINUTOS: "30",
    SEED_INTEGRIDADE_FINAL_PERCENTUAL: "70"
  });

  assert.equal(config.days, 3);
  assert.equal(config.intervalMinutes, 15);
  assert.equal(config.intervalMs, 15 * 60 * 1000);
  assert.equal(config.batchSize, 200);
  assert.equal(config.createAlerts, true);
  assert.equal(config.updateMachines, true);
  assert.equal(config.integrityDays, 30);
  assert.equal(config.integrityIntervalMinutes, 30);
  assert.equal(config.integrityFinalPercent, 70);
});

test("seed leituras calcula progresso e proximo inicio sem duplicar leitura existente", () => {
  const rangeStart = new Date("2026-06-10T00:00:00.000Z");
  const latestReadingDate = new Date("2026-06-10T00:10:00.000Z");
  const intervalMs = 5 * 60 * 1000;

  assert.equal(progressForDate(
    new Date("2026-06-10T12:00:00.000Z"),
    rangeStart,
    new Date("2026-06-11T00:00:00.000Z")
  ), 0.5);
  assert.equal(nextSeedStart({ latestReadingDate, rangeStart, intervalMs }).toISOString(), "2026-06-10T00:15:00.000Z");
});

test("seed leituras gera serie apenas para janela faltante", () => {
  const config = buildConfig({
    SEED_LEITURAS_DIAS: "1",
    SEED_LEITURAS_INTERVALO_MINUTOS: "30",
    SEED_LEITURAS_RUIDO_PERCENTUAL: "0",
    SEED_LEITURAS_GARANTIR_LEITURA_ATUAL: "false"
  });
  const range = {
    start: new Date("2026-06-10T00:00:00.000Z"),
    end: new Date("2026-06-10T02:00:00.000Z")
  };

  const readings = buildReadingsForSensor(sensor, new Date("2026-06-10T01:00:00.000Z"), range, config);

  assert.deepEqual(readings.map((reading) => reading.criadoEm.toISOString()), [
    "2026-06-10T01:30:00.000Z",
    "2026-06-10T02:00:00.000Z"
  ]);
});

test("seed leituras garante leitura atual mesmo quando sensor tinha leitura recente", () => {
  const config = buildConfig({
    SEED_LEITURAS_INTERVALO_MINUTOS: "30",
    SEED_LEITURAS_RUIDO_PERCENTUAL: "0"
  });
  const range = {
    start: new Date("2026-06-10T00:00:00.000Z"),
    end: new Date("2026-06-10T02:00:00.000Z")
  };

  const readings = buildReadingsForSensor(sensor, new Date("2026-06-10T01:45:00.000Z"), range, config);

  assert.deepEqual(readings.map((reading) => reading.criadoEm.toISOString()), [
    "2026-06-10T02:00:00.000Z"
  ]);
});

test("seed leituras respeita specs do sensor e calcula saude", () => {
  const config = buildConfig({
    SEED_LEITURAS_RUIDO_PERCENTUAL: "0",
    SEED_LEITURAS_CRIAR_ALERTAS: "false"
  });
  const range = {
    start: new Date("2026-06-10T00:00:00.000Z"),
    end: new Date("2026-06-11T00:00:00.000Z")
  };

  const reading = buildReading(sensor, new Date("2026-06-11T00:00:00.000Z"), range, config);
  const health = calculateSensorHealth(sensor, reading);

  assert.equal(reading.temperatura, 75.2);
  assert.equal(reading.vibracao, 9.04);
  assert.equal(health, 51.6);
});

test("seed leituras cria historico de integridade em curva configuravel", () => {
  const config = buildConfig({
    SEED_INTEGRIDADE_DIAS_DEGRADACAO: "1",
    SEED_INTEGRIDADE_INTERVALO_MINUTOS: "720",
    SEED_INTEGRIDADE_FINAL_PERCENTUAL: "70"
  });
  const rows = buildIntegrityRowsForMachine({
    maquinaId: 9,
    finalIntegrity: 70,
    finalStability: 75,
    config,
    now: new Date("2026-06-11T12:00:00.000Z")
  });

  assert.deepEqual(rows.map((row) => ({
    integridade: row.integridade,
    scoreEstabilidade: row.scoreEstabilidade,
    criadoEm: row.criadoEm.toISOString()
  })), [
    {
      integridade: 100,
      scoreEstabilidade: 100,
      criadoEm: "2026-06-10T12:00:00.000Z"
    },
    {
      integridade: 85,
      scoreEstabilidade: 87.5,
      criadoEm: "2026-06-11T00:00:00.000Z"
    },
    {
      integridade: 70,
      scoreEstabilidade: 75,
      criadoEm: "2026-06-11T12:00:00.000Z"
    }
  ]);
});

test("seed leituras cria historico de integridade de forma incremental", () => {
  const config = buildConfig({
    SEED_INTEGRIDADE_DIAS_DEGRADACAO: "1",
    SEED_INTEGRIDADE_INTERVALO_MINUTOS: "720",
    SEED_INTEGRIDADE_FINAL_PERCENTUAL: "70"
  });
  const rows = buildIntegrityRowsForMachine({
    maquinaId: 9,
    finalIntegrity: 70,
    finalStability: 75,
    latestHistoryDate: new Date("2026-06-11T00:00:00.000Z"),
    config,
    now: new Date("2026-06-11T12:00:00.000Z")
  });

  assert.deepEqual(rows.map((row) => ({
    integridade: row.integridade,
    scoreEstabilidade: row.scoreEstabilidade,
    criadoEm: row.criadoEm.toISOString()
  })), [
    {
      integridade: 70,
      scoreEstabilidade: 75,
      criadoEm: "2026-06-11T12:00:00.000Z"
    }
  ]);
});
