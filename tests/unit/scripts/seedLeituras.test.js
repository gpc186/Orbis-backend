const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  buildConfig,
  buildIntegrityRowsForMachine,
  buildReading,
  buildReadingsForSensor,
  buildSeedAlertRowsForMachine,
  calculateSensorHealth,
  getLatestIntegrityRowsByMachine,
  integrityTargetForProgress,
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
    SEED_INTEGRIDADE_FINAL_PERCENTUAL: "70",
    SEED_INTEGRIDADE_JANELA_RECENTE_DIAS: "7",
    SEED_INTEGRIDADE_INICIO_JANELA_RECENTE_PERCENTUAL: "91",
    SEED_INTEGRIDADE_CURVA_POTENCIA: "1.2",
    SEED_INTEGRIDADE_OSCILACAO_PERCENTUAL: "0.5",
    SEED_LEITURAS_CURVA_POTENCIA: "1.1"
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
  assert.equal(config.integrityRecentWindowDays, 7);
  assert.equal(config.integrityRecentStartPercent, 91);
  assert.equal(config.integrityCurvePower, 1.2);
  assert.equal(config.integrityOscillationPercent, 0.5);
  assert.equal(config.sensorCurvePower, 1.1);
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
    SEED_LEITURAS_CRIAR_ALERTAS: "false",
    SEED_INTEGRIDADE_FINAL_PERCENTUAL: "70"
  });
  const range = {
    start: new Date("2026-06-10T00:00:00.000Z"),
    end: new Date("2026-06-11T00:00:00.000Z")
  };

  const reading = buildReading(sensor, new Date("2026-06-11T00:00:00.000Z"), range, config);
  const health = calculateSensorHealth(sensor, reading);

  assert.equal(reading.temperatura, 52);
  assert.equal(reading.vibracao, 4.4);
  assert.equal(health, 70);
});

test("seed leituras cria historico de integridade em curva configuravel", () => {
  const config = buildConfig({
    SEED_INTEGRIDADE_DIAS_DEGRADACAO: "1",
    SEED_INTEGRIDADE_INTERVALO_MINUTOS: "720",
    SEED_INTEGRIDADE_FINAL_PERCENTUAL: "70"
  });
  const rows = buildIntegrityRowsForMachine({
    maquinaId: 9,
    sensors: [sensor],
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
      integridade: 88.46,
      scoreEstabilidade: 92.03,
      criadoEm: "2026-06-11T00:00:00.000Z"
    }
  ]);
});

test("seed leituras concentra degradacao na janela recente usada pela predicao", () => {
  const config = buildConfig({
    SEED_INTEGRIDADE_DIAS_DEGRADACAO: "30",
    SEED_INTEGRIDADE_FINAL_PERCENTUAL: "80",
    SEED_INTEGRIDADE_JANELA_RECENTE_DIAS: "7",
    SEED_INTEGRIDADE_INICIO_JANELA_RECENTE_PERCENTUAL: "92",
    SEED_INTEGRIDADE_OSCILACAO_PERCENTUAL: "0"
  });

  assert.equal(integrityTargetForProgress(0, config), 100);
  assert.equal(Number(integrityTargetForProgress(23 / 30, config).toFixed(2)), 92);
  assert.equal(Number(integrityTargetForProgress(0.95, config).toFixed(2)), 82.91);
  assert.equal(Number(integrityTargetForProgress(1, config).toFixed(2)), 80);
});

test("seed leituras monta alertas sinteticos para alimentar features de risco", () => {
  const config = buildConfig({
    SEED_LEITURAS_RUIDO_PERCENTUAL: "0",
    SEED_LEITURAS_CRIAR_ALERTAS: "true",
    SEED_INTEGRIDADE_DIAS_DEGRADACAO: "1",
    SEED_INTEGRIDADE_INTERVALO_MINUTOS: "720",
    SEED_INTEGRIDADE_FINAL_PERCENTUAL: "40"
  });
  const historicoRows = buildIntegrityRowsForMachine({
    maquinaId: 2,
    sensors: [sensor],
    config,
    now: new Date("2026-06-11T12:00:00.000Z")
  });
  const latestReadingsBySensor = new Map([
    [sensor.id, buildReading(sensor, new Date("2026-06-11T12:00:00.000Z"), {
      start: new Date("2026-06-10T12:00:00.000Z"),
      end: new Date("2026-06-11T12:00:00.000Z")
    }, config)]
  ]);

  const alertas = buildSeedAlertRowsForMachine({
    maquina: sensor.maquina,
    sensors: [sensor],
    latestReadingsBySensor,
    historicoRows,
    config
  });

  assert.equal(alertas.some((alerta) => alerta.tipo === "TENDENCIA_LONGA"), true);
  assert.equal(alertas.some((alerta) => alerta.tipo === "TENDENCIA_CURTA"), true);
  assert.equal(alertas.some((alerta) => alerta.tipo === "INSTABILIDADE"), true);
  assert.equal(alertas.every((alerta) => alerta.mensagem.includes("[SEED_LEITURAS]")), true);
});

test("seed leituras cria historico de integridade de forma incremental", () => {
  const config = buildConfig({
    SEED_INTEGRIDADE_DIAS_DEGRADACAO: "1",
    SEED_INTEGRIDADE_INTERVALO_MINUTOS: "720",
    SEED_INTEGRIDADE_FINAL_PERCENTUAL: "70"
  });
  const rows = buildIntegrityRowsForMachine({
    maquinaId: 9,
    sensors: [sensor],
    latestHistoryDate: new Date("2026-06-11T00:00:00.000Z"),
    config,
    now: new Date("2026-06-11T12:00:00.000Z")
  });

  assert.deepEqual(rows.map((row) => ({
    integridade: row.integridade,
    scoreEstabilidade: row.scoreEstabilidade,
    criadoEm: row.criadoEm.toISOString()
  })), []);
});

test("seed leituras seleciona ultimo ponto sintetico por maquina para atualizar saude", () => {
  const rows = [
    { maquinaId: 1, integridade: 82, criadoEm: new Date("2026-06-11T10:00:00.000Z") },
    { maquinaId: 2, integridade: 91, criadoEm: new Date("2026-06-11T10:30:00.000Z") },
    { maquinaId: 1, integridade: 80, criadoEm: new Date("2026-06-11T11:00:00.000Z") }
  ];

  const latest = getLatestIntegrityRowsByMachine(rows);

  assert.equal(latest.get(1).integridade, 80);
  assert.equal(latest.get(2).integridade, 91);
});
