const AppError = require("../utils/appErrorUtils");
const EmailService = require("./emailService");
const { validateContatoPayload } = require("../utils/emailValidation");

class ContatoService {
  static getDestinoContato() {
    const { CONTACT_TO_EMAIL } = process.env;
    if (!CONTACT_TO_EMAIL) {
      throw new AppError("CONTACT_TO_EMAIL não configurado.", 500);
    }
    return CONTACT_TO_EMAIL;
  }

  static buildContatoHtml({ nome, email, assunto, mensagem }) {
    const mensagemHtml = mensagem.replace(/\n/g, "<br/>");

    return `
      <h2>Novo contato recebido</h2>
      <p><strong>Nome:</strong> ${nome}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Assunto:</strong> ${assunto}</p>
      <p><strong>Mensagem:</strong><br/>${mensagemHtml}</p>
    `;
  }

  static buildContatoText({ nome, email, assunto, mensagem }) {
    return [
      "Novo contato recebido",
      `Nome: ${nome}`,
      `Email: ${email}`,
      `Assunto: ${assunto}`,
      "",
      "Mensagem:",
      mensagem
    ].join("\n");
  }

  static async enviarContato(payload) {
    const data = validateContatoPayload(payload);
    const to = this.getDestinoContato();

    const result = await EmailService.send({
      to,
      subject: `[Fale Conosco] ${data.assunto}`,
      html: this.buildContatoHtml(data),
      text: this.buildContatoText(data),
      replyTo: data.email
    });

    return {
      enviadoPara: to,
      provider: result.provider,
      messageId: result.messageId
    };
  }
}

module.exports = ContatoService;