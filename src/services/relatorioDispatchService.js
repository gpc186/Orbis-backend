const EmailService = require("./emailService");

class RelatorioDispatchService {
  static chunk(values, size) {
    const groups = [];

    for (let index = 0; index < values.length; index += size) {
      groups.push(values.slice(index, index + size));
    }

    return groups;
  }

  static async send({ emailsDestino, subject, html, text }) {
    const batches = this.chunk(emailsDestino, 50);
    const results = [];

    for (const batch of batches) {
      const response = await EmailService.send({
        to: batch,
        subject,
        html,
        text
      });

      results.push({
        provider: response.provider,
        messageId: response.messageId,
        recipients: batch
      });
    }

    return {
      provider: results[0]?.provider || "resend",
      messageId: results[0]?.messageId || null,
      batches: results
    };
  }
}

module.exports = RelatorioDispatchService;
