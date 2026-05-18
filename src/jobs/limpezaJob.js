const cron = require("node-cron");
const LeituraModel = require("../models/leituraModel");
const logger = require("../utils/logger");

const cronExpression = "0 0 * * *";

cron.schedule(cronExpression, async () => {
  const startedAt = Date.now();

  try {
    logger.info("limpeza_job_started", {
      cronExpression
    });

    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);

    const quantidadeDeletada = await LeituraModel.limpeza(trintaDiasAtras);

    logger.info("limpeza_job_finished", {
      leiturasDeletadas: quantidadeDeletada.count,
      durationMs: Date.now() - startedAt
    });
  } catch (error) {
    logger.error("limpeza_job_error", {
      durationMs: Date.now() - startedAt,
      error
    });
  }
});
