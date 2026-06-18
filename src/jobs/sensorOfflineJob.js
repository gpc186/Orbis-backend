const cron = require("node-cron");
const SensorModel = require("../models/sensorModel");
const logger = require("../utils/logger");
const cacheMiddleware = require("../middlewares/cacheMiddleware");

const enabled = String(process.env.SENSOR_OFFLINE_JOB_ENABLED || "true").toLowerCase() === "true";
const intervaloConfigurado = Number(process.env.SENSOR_OFFLINE_INTERVAL_SECONDS);
const intervaloSimuladorMs = Number(process.env.SIMULADOR_INTERVALO_MS);
const multiplicadorFolgaSimulador = Number(process.env.SENSOR_OFFLINE_SIMULADOR_GRACE_MULTIPLIER);
const intervaloSegundos = Number.isFinite(intervaloConfigurado) && intervaloConfigurado > 0
  ? intervaloConfigurado
  : 15;
const intervaloEfetivoSegundos = calcularIntervaloEfetivoSegundos({
  intervaloSegundos,
  intervaloSimuladorMs,
  multiplicadorFolgaSimulador,
  simuladorAtivo: process.env.SIMULADOR_JOB_ATIVO !== "false"
});
const cronExpression = "*/5 * * * * *";

function calcularIntervaloEfetivoSegundos({
  intervaloSegundos,
  intervaloSimuladorMs,
  multiplicadorFolgaSimulador,
  simuladorAtivo
}) {
  if (!simuladorAtivo || !Number.isFinite(intervaloSimuladorMs) || intervaloSimuladorMs <= 0) {
    return intervaloSegundos;
  }

  const multiplicador = Number.isFinite(multiplicadorFolgaSimulador) && multiplicadorFolgaSimulador > 0
    ? multiplicadorFolgaSimulador
    : 4;
  const intervaloMinimoSimulador = Math.ceil((intervaloSimuladorMs / 1000) * multiplicador);

  return Math.max(intervaloSegundos, intervaloMinimoSimulador);
}

if (enabled) {
  cron.schedule(cronExpression, async () => {
    const startedAt = Date.now();

    try {
      logger.info("sensor_offline_job_started", {
        cronExpression,
        intervaloSegundos: intervaloEfetivoSegundos,
        intervaloConfiguradoSegundos: intervaloSegundos
      });

      const limiteOffline = new Date();
      limiteOffline.setSeconds(limiteOffline.getSeconds() - intervaloEfetivoSegundos);

      const response = await SensorModel.updateStatus(limiteOffline);
      if (response.count > 0) {
        cacheMiddleware.clearCache();
      }

      logger.info("sensor_offline_job_finished", {
        sensoresAtualizados: response.count,
        durationMs: Date.now() - startedAt
      });
    } catch (error) {
      logger.error("sensor_offline_job_error", {
        durationMs: Date.now() - startedAt,
        error
      });
    }
  });
} else {
  logger.info("sensor_offline_job_disabled", {
    cronExpression,
    intervaloSegundos: intervaloEfetivoSegundos,
    intervaloConfiguradoSegundos: intervaloSegundos
  });
}

module.exports = {
  _internals: {
    calcularIntervaloEfetivoSegundos
  }
};
