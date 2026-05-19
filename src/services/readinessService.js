const prisma = require("../prisma/prisma");
const { REPORT_TIMEZONE } = require("../utils/reportScheduleUtils");
const logger = require("../utils/logger");

class ReadinessService {
  static async checkDatabase() {
    try {
      await prisma.$queryRaw`SELECT 1`;

      return {
        status: "up"
      };
    } catch (error) {
      logger.warn("readiness_database_failed", {
        service: "database",
        error
      });

      return {
        status: "down",
        reason: "database_unreachable"
      };
    }
  }

  static checkEmail() {
    const hasApiKey = Boolean(process.env.RESEND_API_KEY);
    const hasFromEmail = Boolean(process.env.RESEND_FROM_EMAIL);

    if (hasApiKey && hasFromEmail) {
      return {
        status: "configured"
      };
    }

    return {
      status: "misconfigured",
      missing: [
        !hasApiKey ? "RESEND_API_KEY" : null,
        !hasFromEmail ? "RESEND_FROM_EMAIL" : null
      ].filter(Boolean)
    };
  }

  static checkAi() {
    const hasApiKey = Boolean(process.env.GROQ_API_KEY);

    if (hasApiKey) {
      return {
        status: "configured",
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile"
      };
    }

    return {
      status: "misconfigured",
      missing: ["GROQ_API_KEY"]
    };
  }

  static checkJobs() {
    const reportEnabled = String(process.env.REPORT_JOB_ENABLED || "false").toLowerCase() === "true";
    const simuladorEnabled = process.env.SIMULADOR_JOB_ATIVO !== "false";

    return {
      relatorio: {
        status: reportEnabled ? "enabled" : "disabled",
        cron: process.env.REPORT_JOB_CRON || "* * * * *",
        timezone: REPORT_TIMEZONE
      },
      simulador: {
        status: simuladorEnabled ? "enabled" : "disabled",
        intervalMs: Number(process.env.SIMULADOR_INTERVALO_MS) || 5000
      }
    };
  }

  static isReady(services) {
    return (
      services.database.status === "up" &&
      services.email.status === "configured" &&
      services.ai.status === "configured"
    );
  }

  static async check() {
    const services = {
      database: await this.checkDatabase(),
      email: this.checkEmail(),
      ai: this.checkAi(),
      jobs: this.checkJobs()
    };

    return {
      ok: this.isReady(services),
      services,
      time: new Date().toISOString()
    };
  }
}

module.exports = ReadinessService;
