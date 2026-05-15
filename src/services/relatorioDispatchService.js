const EmailService = require("./emailService");

class RelatorioDispatchService {
  static async send({ emailsDestino, subject, html, text }) {
    const response = await EmailService.send({
      to: emailsDestino,
      subject,
      html,
      text
    });

    return {
      provider: response.provider,
      messageId: response.messageId
    };
  }
}

module.exports = RelatorioDispatchService;