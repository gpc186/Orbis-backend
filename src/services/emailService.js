// src/services/emailService.js
const nodemailer = require("nodemailer");
const AppError = require("../utils/appErrorUtils");

class EmailService {
  static validateConfig() {
    const { SMTP_USER, SMTP_PASS, CONTACT_TO_EMAIL } = process.env;

    if (!SMTP_USER || !SMTP_PASS) {
      throw new AppError("SMTP_USER/SMTP_PASS não configurados.", 500);
    }

    if (!CONTACT_TO_EMAIL) {
      throw new AppError("CONTACT_TO_EMAIL não configurado.", 500);
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
      }
    });

  }

  static sanitize(input) {
    return String(input || "").trim();
  }

  static async sendContactEmail({ nome, email, assunto, mensagem }) {
    const { SMTP_USER, CONTACT_TO_EMAIL } = this.validateConfig();

    const nomeSafe = this.sanitize(nome);
    const emailSafe = this.sanitize(email);
    const assuntoSafe = this.sanitize(assunto);
    const mensagemSafe = this.sanitize(mensagem);

    if (!nomeSafe || !emailSafe || !assuntoSafe || !mensagemSafe) {
      throw new AppError("Campos obrigatórios do contato não informados.", 400);
    }

    const transporter = this.createTransporter();

    const mailOptions = {
      from: `"Orbis - Fale Conosco" <${SMTP_USER}>`,
      to: CONTACT_TO_EMAIL,
      replyTo: emailSafe,
      subject: `[Fale Conosco] ${assuntoSafe}`,
      text: [
        `Nome: ${nomeSafe}`,
        `Email: ${emailSafe}`,
        "",
        "Mensagem:",
        mensagemSafe
      ].join("\n"),
      html: `
        <h3>Nova mensagem - Fale Conosco</h3>
        <p><strong>Nome:</strong> ${nomeSafe}</p>
        <p><strong>Email:</strong> ${emailSafe}</p>
        <p><strong>Assunto:</strong> ${assuntoSafe}</p>
        <p><strong>Mensagem:</strong><br/>${mensagemSafe.replace(/\n/g, "<br/>")}</p>
      `
    };

    try {
      const info = await transporter.sendMail(mailOptions);

      return {
        messageId: info.messageId,
        accepted: info.accepted || []
      };
    } catch (error) {
      throw new AppError("Falha ao enviar email de contato.", 502);
    }
  }
}

module.exports = EmailService;