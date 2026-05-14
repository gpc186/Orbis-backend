const AppError = require("../utils/appErrorUtils");
const { Resend } = require("resend");

class ReportEmailService {
  static getConfig() {
    const { RESEND_API_KEY, RESEND_FROM_EMAIL } = process.env;

    if (!RESEND_API_KEY) {
      throw new AppError("RESEND_API_KEY não configurada.", 500);
    }

    if (!RESEND_FROM_EMAIL) {
      throw new AppError("RESEND_FROM_EMAIL não configurado.", 500);
    }

    return { apiKey: RESEND_API_KEY, from: RESEND_FROM_EMAIL };
  }

  static getClient() {
    const { apiKey } = this.getConfig();
    return new Resend(apiKey);
  }

  static async sendReportEmail({ to, subject, html }) {
    const { from } = this.getConfig();
    const resend = this.getClient();

    try {
      const response = await resend.emails.send({
        from,
        to,
        subject,
        html
      });

      return { messageId: response?.data?.id || null };
    } catch (error) {
      console.error("[report-email][send_error]", {
        name: error?.name,
        message: error?.message
      });

      throw new AppError("Falha ao enviar relatório por email.", 502);
    }
  }
}

module.exports = ReportEmailService;