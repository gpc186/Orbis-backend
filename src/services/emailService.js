const nodemailer = require("nodemailer");
const AppError = require("../utils/appErrorUtils");

class EmailService {
  static validateConfig() {
    const { SMTP_USER, SMTP_PASS, CONTACT_TO_EMAIL } = process.env;

    if (!SMTP_USER || !SMTP_PASS) {
      throw new AppError("Configuração SMTP ausente.", 500);
    }

    if (!CONTACT_TO_EMAIL) {
      throw new AppError("Destinatário de contato não configurado.", 500);
    }

    return { SMTP_USER, SMTP_PASS, CONTACT_TO_EMAIL };
  }

  static createTransporter() {
    const { SMTP_USER, SMTP_PASS } = this.validateConfig();

    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000
    });
  }

  static async sendContactEmail({ nome, email, assunto, mensagem }) {
    const { SMTP_USER, CONTACT_TO_EMAIL } = this.validateConfig();
    const transporter = this.createTransporter();

    const mailOptions = {
      from: `"Orbis - Fale Conosco" <${SMTP_USER}>`,
      to: CONTACT_TO_EMAIL,
      replyTo: email,
      subject: `[Fale Conosco] ${assunto}`,
      text: `Nome: ${nome}\nEmail: ${email}\n\nMensagem:\n${mensagem}`
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      return { messageId: info.messageId };
    } catch (error) {
      console.error("[email][send_error]", {
        code: error?.code,
        responseCode: error?.responseCode
      });
      throw new AppError("Não foi possível enviar o email no momento.", 502);
    }
  }
}

module.exports = EmailService;