const { Resend } = require("resend");
const AppError = require("../utils/appErrorUtils");

class EmailService {
  static getConfig() {
    const { RESEND_API_KEY, RESEND_FROM_EMAIL } = process.env;

    if (!RESEND_API_KEY) {
      throw new AppError("RESEND_API_KEY não configurada.", 500);
    }

    if (!RESEND_FROM_EMAIL) {
      throw new AppError("RESEND_FROM_EMAIL não configurado.", 500);
    }

    return {
      apiKey: RESEND_API_KEY,
      from: RESEND_FROM_EMAIL
    };
  }

  static getClient() {
    const { apiKey } = this.getConfig();
    return new Resend(apiKey);
  }

  /**
   * @param {Object} params
   * @param {string|string[]} params.to
   * @param {string} params.subject
   * @param {string} [params.html]
   * @param {string} [params.text]
   * @param {string} [params.replyTo]
   */
  static async send({ to, subject, html, text, replyTo }) {
    const { from } = this.getConfig();
    const resend = this.getClient();

    if (!to || (Array.isArray(to) && to.length === 0)) {
      throw new AppError("Destinatário inválido.", 400);
    }

    if (!subject || String(subject).trim().length < 3) {
      throw new AppError("Assunto inválido.", 400);
    }

    if (!html && !text) {
      throw new AppError("Conteúdo de email ausente.", 400);
    }

    try {
      const response = await resend.emails.send({
        from,
        to,
        subject,
        html,
        text,
        reply_to: replyTo // no Resend é reply_to
      });

      return {
        provider: "resend",
        messageId: response?.data?.id ?? null
      };
    } catch (error) {
      console.error("[email][send_error]", {
        name: error?.name,
        message: error?.message
      });
      throw new AppError("Falha ao enviar email.", 502);
    }
  }

  static async enviarCodigoRedefinicao({ para, nome, code }) {
    return this.send({
      to: para,
      subject: "Código de redefinição de senha — Orbis",
      html: `
        <h2>Olá, ${nome}!</h2>
        <p>Seu código para redefinir a senha é:</p>
        <h1 style="letter-spacing: 8px; color: #3182ce;">${code}</h1>
        <p>Este código expira em <strong>15 minutos</strong>.</p>
        <p>Se você não solicitou isso, ignore este email.</p>
      `
    });
  }
}

module.exports = EmailService;