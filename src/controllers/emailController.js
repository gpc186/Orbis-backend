const ContatoService = require("../services/contatoService");

class EmailController {
  static async enviarContato(req, res, next) {
    try {
      const { nome, email, assunto, mensagem } = req.body;

      const result = await ContatoService.enviarContato({
        nome,
        email,
        assunto,
        mensagem
      });

      return res.status(200).json({
        message: "Mensagem enviada com sucesso.",
        ...result
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = EmailController;