const cron = require("node-cron");
const prisma = require("../prisma/prisma");
const AlertaService = require("../services/alertaService");
const MaquinaService = require("../services/maquinaService");
const logger = require("../utils/logger");

const CRON_EXPRESSION = "*/30 * * * *";

cron.schedule(CRON_EXPRESSION, async () => {
  if (process.env.NODE_ENV !== "PRODUCTION") {
    return;
  }

  const startedAt = Date.now();

  try {
    logger.info("tendencia_job_started", {
      cronExpression: CRON_EXPRESSION
    });

    const sensores = await prisma.sensor.findMany({
      where: { status: "ONLINE" },
      include: { maquina: true }
    });

    let alertasGerados = 0;

    for (const sensor of sensores) {
      const agora = Date.now();

      const media2h = await calcularMedia(sensor.id, agora - (2 * 60 * 60 * 1000));
      const media24h = await calcularMedia(sensor.id, agora - (24 * 60 * 60 * 1000));
      const media7d = await calcularMedia(sensor.id, agora - (168 * 60 * 60 * 1000));

      if (media2h > media24h * 1.15 && media24h > 0) {
        await AlertaService.gerarAlerta(
          sensor.id,
          sensor.maquinaId,
          "TENDENCIA_CURTA",
          `Aumento repentino de 15% na vibracao nas ultimas 2h: Media ${media2h.toFixed(2)}`
        );

        await MaquinaService.update(sensor.maquinaId, {
          scoreEstabilidade: { decrement: 5 },
          integridade: { decrement: 2 }
        });

        alertasGerados += 1;
      }

      if (media24h > media7d * 1.15 && media7d > 0) {
        await AlertaService.gerarAlerta(
          sensor.id,
          sensor.maquinaId,
          "TENDENCIA_LONGA",
          `Aumento de 15% na vibracao nas ultimas 24h: Media ${media24h.toFixed(2)}`
        );

        await MaquinaService.update(sensor.maquinaId, {
          scoreEstabilidade: { decrement: 3 },
          integridade: { decrement: 1 }
        });

        alertasGerados += 1;
      }
    }

    logger.info("tendencia_job_finished", {
      sensoresProcessados: sensores.length,
      alertasGerados,
      durationMs: Date.now() - startedAt
    });
  } catch (error) {
    logger.error("tendencia_job_error", {
      durationMs: Date.now() - startedAt,
      error
    });
  }
});

async function calcularMedia(sensorId, dataInicio) {
  const resultado = await prisma.leitura.aggregate({
    _avg: { vibracao: true },
    where: { sensorId, criadoEm: { gte: new Date(dataInicio) } }
  });

  return resultado._avg.vibracao || 0;
}
