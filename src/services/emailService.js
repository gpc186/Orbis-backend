const { Resend } = require("resend");
const AppError = require("../utils/appErrorUtils");

class EmailService {
  static #client = null;

  static validateConfig() {
    const { RESEND_API_KEY, CONTACT_TO_EMAIL } = process.env;

    if (!RESEND_API_KEY) {
      throw new AppError("RESEND_API_KEY não configurada.", 500);
    }

    if (!CONTACT_TO_EMAIL) {
      throw new AppError("Destinatário de contato não configurado.", 500);
    }

    return { RESEND_API_KEY, CONTACT_TO_EMAIL };
  }

  static getClient() {
    if (!this.#client) {
      const { RESEND_API_KEY } = this.validateConfig();
      this.#client = new Resend(RESEND_API_KEY);
    }
    return this.#client;
  }

  static async sendContactEmail({ nome, email, assunto, mensagem }) {
    const { CONTACT_TO_EMAIL } = this.validateConfig();
    const client = this.getClient();

    try {
      const { error } = await client.emails.send({
        from: "Orbis <onboarding@resend.dev>",
        to: CONTACT_TO_EMAIL,
        replyTo: email,
        subject: `[Fale Conosco] ${assunto}`,
        html: `
          <p><strong>Nome:</strong> ${nome}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Mensagem:</strong></p>
          <p>${mensagem}</p>
        `
      });

      if (error) {
        console.error("[email][send_error]", { message: error?.message });
        throw new AppError("Não foi possível enviar o email no momento.", 502);
      }

    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("[email][send_error]", { message: error?.message });
      throw new AppError("Não foi possível enviar o email no momento.", 502);
    }
  }
}

module.exports = EmailService;