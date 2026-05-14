const AppError = require("../utils/appErrorUtils");
const EmailService = require("./emailService");
const {
  normalizeEmails,
  isValidEmail
} = require("../utils/emailValidation");
const { validatePreviewPayload } = require("../utils/reportValidation");
const RelatorioRendererService = require("./relatorioRendererService");

class RelatorioService {
  static assertAdmin(usuario) {
    if (!usuario || usuario.role !== "ADMIN") {
      throw new AppError("Apenas ADMIN pode enviar relatório.", 403);
    }
  }

  static validateDestinatarios(emailsDestino) {
    const to = normalizeEmails(emailsDestino);

    if (to.length === 0) {
      throw new AppError("Informe ao menos um email de destino.", 400);
    }

    if (to.length > 10) {
      throw new AppError("Máximo de 10 destinatários por envio.", 400);
    }

    const invalid = to.find((email) => !isValidEmail(email));
    if (invalid) {
      throw new AppError(`Email inválido: ${invalid}`, 400);
    }

    return to;
  }

  static async enviarAgora({
    usuario,
    emailsDestino,
    assunto,
    nome,
    periodo,
    filtros
  }) {
    this.assertAdmin(usuario);

    const to = this.validateDestinatarios(emailsDestino);

    const validated = validatePreviewPayload({
      nome,
      assunto,
      periodo,
      filtros
    });

    const rendered = await RelatorioRendererService.render(validated);
    const subject = rendered.subject;
    const html = rendered.html;
    const text = rendered.text;

    const result = await EmailService.send({
      to,
      subject,
      html,
      text
    });

    return {
      enviadoPara: to,
      quantidadeDestinatarios: to.length,
      provider: result.provider,
      messageId: result.messageId,
      enviadoEm: new Date().toISOString(),
      origemTemplate: "backend"
    };
  }
}

module.exports = RelatorioService;
