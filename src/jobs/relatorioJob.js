const cron = require("node-cron");
const RelatorioAgendamentoService = require("../services/relatorioAgendamentoService");
const logger = require("../utils/logger");

const enabled = String(process.env.REPORT_JOB_ENABLED || "false").toLowerCase() === "true";
const cronExpression = process.env.REPORT_JOB_CRON || "* * * * *";
const timezone = process.env.REPORT_JOB_TIMEZONE || "America/Sao_Paulo";

if (enabled) {
  logger.info("relatorio_job_started", {
    cronExpression,
    timezone
  });

  cron.schedule(
    cronExpression,
    async () => {
      const startedAt = Date.now();

      try {
        const processed = await RelatorioAgendamentoService.processDueSchedules();

        logger.info("relatorio_job_finished", {
          processedCount: processed.length,
          durationMs: Date.now() - startedAt
        });
      } catch (error) {
        logger.error("relatorio_job_error", {
          durationMs: Date.now() - startedAt,
          error
        });
      }
    },
    { timezone }
  );
}
