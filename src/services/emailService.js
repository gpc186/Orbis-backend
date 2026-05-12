const { Resend } = require("resend");
const AppError = require("../utils/appErrorUtils");
const ReportEmailService = require("./reportEmailService");

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
  static sanitizeText(input = "") {
    return String(input).trim();
  }

  static validatePayload({ emailDestino, assunto, htmlRelatorio }) {
    const email = this.sanitizeText(emailDestino).toLowerCase();
    const subject = this.sanitizeText(assunto);
    const html = String(htmlRelatorio || "").trim();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email) || email.length > 120) {
      throw new AppError("Email de destino inválido.", 400);
    }

    if (subject.length < 3 || subject.length > 140) {
      throw new AppError("Assunto inválido.", 400);
    }

    if (!html || html.length < 20) {
      throw new AppError("HTML do relatório inválido.", 400);
    }

    if (html.length > 300_000) {
      throw new AppError("Relatório HTML muito grande.", 400);
    }

    return { email, subject, html };
  }

  static assertAdmin(usuario) {
    if (!usuario || usuario.role !== "ADMIN") {
      throw new AppError("Apenas ADMIN pode enviar relatório.", 403);
    }
  }

  static async enviarAgora({ usuario, emailDestino, assunto, htmlRelatorio }) {
    this.assertAdmin(usuario);

    const { email, subject, html } = this.validatePayload({
      emailDestino,
      assunto,
      htmlRelatorio
    });

    const envio = await ReportEmailService.sendReportEmail({
      to: email,
      subject,
      html
    });

    return {
      enviadoPara: email,
      messageId: envio.messageId || null,
      provider: "resend",
      enviadoEm: new Date().toISOString()
    };
  }
}

module.exports = EmailService;