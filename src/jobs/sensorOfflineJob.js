const cron = require("node-cron");
const SensorModel = require("../models/sensorModel");
const logger = require("../utils/logger");

const intervaloConfigurado = Number(process.env.SENSOR_OFFLINE_INTERVAL_SECONDS);
const intervaloSegundos = Number.isFinite(intervaloConfigurado) && intervaloConfigurado > 0
  ? intervaloConfigurado
  : 15;
const cronExpression = "*/5 * * * * *";

cron.schedule(cronExpression, async () => {
  const startedAt = Date.now();

  try {
    logger.info("sensor_offline_job_started", {
      cronExpression,
      intervaloSegundos
    });

    const limiteOffline = new Date();
    limiteOffline.setSeconds(limiteOffline.getSeconds() - intervaloSegundos);

    const response = await SensorModel.updateStatus(limiteOffline);

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
