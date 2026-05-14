const cron = require("node-cron");
const RelatorioAgendamentoService = require("../services/relatorioAgendamentoService");

const enabled = String(process.env.REPORT_JOB_ENABLED || "false").toLowerCase() === "true";
const cronExpression = process.env.REPORT_JOB_CRON || "* * * * *";
const timezone = process.env.REPORT_JOB_TIMEZONE || "America/Sao_Paulo";

if (enabled) {
  cron.schedule(
    cronExpression,
    async () => {
      try {
        const processed = await RelatorioAgendamentoService.processDueSchedules();

        if (processed.length > 0) {
          console.log("[relatorio-job] execucoes processadas:", processed.length);
        }
      } catch (error) {
        console.error("[relatorio-job] erro ao processar agendamentos:", error.message);
      }
    },
    { timezone }
  );
}
