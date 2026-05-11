const EmailService = require("../services/emailService");

function maskEmail(email = "") {
  const [user, domain] = String(email).split("@");
  if (!user || !domain) return "***";
  return `${user.slice(0, 2)}***@${domain}`;
}

class ContatoController {
  static async enviar(req, res, next) {
    const startedAt = Date.now();

    try {
      const { nome, email, assunto, mensagem } = req.body;
      await EmailService.sendContactEmail({ nome, email, assunto, mensagem });

      console.info("[contato][ok]", {
        ip: req.ip,
        email: maskEmail(email),
        durationMs: Date.now() - startedAt
      });

      return res.status(200).json({ message: "Mensagem enviada com sucesso!" });
    } catch (error) {
      console.warn("[contato][error]", {
        ip: req.ip,
        durationMs: Date.now() - startedAt,
        status: error?.statusCode || 500
      });

      return next(error);
    }
  }
}

module.exports = ContatoController;