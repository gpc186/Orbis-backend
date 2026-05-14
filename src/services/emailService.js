const { Resend } = require("resend");
const AppError = require("../utils/appErrorUtils");

class EmailService {
  static getConfig() {
    const { RESEND_API_KEY, RESEND_FROM_EMAIL } = process.env;

    if (!RESEND_API_KEY) {
      throw new AppError("RESEND_API_KEY nao configurada.", 500);
    }

    if (!RESEND_FROM_EMAIL) {
      throw new AppError("RESEND_FROM_EMAIL nao configurado.", 500);
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
      throw new AppError("Destinatario invalido.", 400);
    }

    if (!subject || String(subject).trim().length < 3) {
      throw new AppError("Assunto invalido.", 400);
    }

    if (!html && !text) {
      throw new AppError("Conteudo de email ausente.", 400);
    }

    try {
      const response = await resend.emails.send({
        from,
        to,
        subject,
        html,
        text,
        reply_to: replyTo
      });

      if (response?.error) {
        console.error("[email][provider_error]", {
          provider: "resend",
          statusCode: response.error.statusCode,
          name: response.error.name,
          message: response.error.message
        });

        throw new AppError(
          response.error.message || "Falha ao enviar email pelo provedor.",
          response.error.statusCode || 502
        );
      }

      const messageId = response?.data?.id ?? null;

      if (!messageId) {
        console.error("[email][missing_message_id]", {
          provider: "resend",
          from,
          toCount: Array.isArray(to) ? to.length : 1
        });

        throw new AppError("O provedor de email nao confirmou o envio.", 502);
      }

      return {
        provider: "resend",
        messageId
      };
    } catch (error) {
      console.error("[email][send_error]", {
        name: error?.name,
        message: error?.message,
        statusCode: error?.statusCode || error?.status
      });

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError("Falha ao enviar email.", 502);
    }
  }

  static async enviarCodigoRedefinicao({ para, nome, code }) {
    return this.send({
      to: para,
      subject: "Codigo de redefinicao de senha - Orbis",
      html: `
        <h2>Ola, ${nome}!</h2>
        <p>Seu codigo para redefinir a senha e:</p>
        <h1 style="letter-spacing: 8px; color: #3182ce;">${code}</h1>
        <p>Este codigo expira em <strong>15 minutos</strong>.</p>
        <p>Se voce nao solicitou isso, ignore este email.</p>
      `
    });
  }
}

module.exports = EmailService;
