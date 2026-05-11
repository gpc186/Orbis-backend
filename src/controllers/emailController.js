// src/controllers/contatoController.js
const EmailService = require("../services/emailService");

class ContatoController {
  static async enviar(req, res, next) {
    try {
      const { nome, email, assunto, mensagem } = req.body;
      await EmailService.sendContactEmail({ nome, email, assunto, mensagem });

      return res.status(200).json({ message: "Mensagem enviada com sucesso!" });
    } catch (err) {
      return next(err);
    }
  }
}

module.exports = ContatoController;