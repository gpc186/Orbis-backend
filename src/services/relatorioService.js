const AppError = require("../utils/appErrorUtils");
const EmailService = require("./emailService");
const { validateRelatorioPayload } = require("../utils/emailValidation");

class RelatorioService {
  static assertAdmin(usuario) {
    if (!usuario || usuario.role !== "ADMIN") {
      throw new AppError("Apenas ADMIN pode enviar relatório.", 403);
    }
  }

  static async enviarAgora({ usuario, emailsDestino, assunto, htmlRelatorio }) {
    this.assertAdmin(usuario);

    const { to, subject, html } = validateRelatorioPayload({
      emailsDestino,
      assunto,
      htmlRelatorio
    });

    const result = await EmailService.send({
      to,
      subject,
      html
    });

    return {
      enviadoPara: to,
      quantidadeDestinatarios: to.length,
      provider: result.provider,
      messageId: result.messageId,
      enviadoEm: new Date().toISOString()
    };
  }
}

module.exports = RelatorioService;