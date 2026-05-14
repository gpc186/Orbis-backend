const RelatorioService = require("../services/relatorioService");

class RelatorioController {
  static async enviarAgora(req, res, next) {
    try {
      const usuario = req.usuario;
      const {
        emailsDestino,
        assunto,
        nome,
        periodo,
        filtros
      } = req.body;

      const result = await RelatorioService.enviarAgora({
        usuario,
        emailsDestino,
        assunto,
        nome,
        periodo,
        filtros
      });

      return res.status(200).json({
        message: "Relatório enviado com sucesso.",
        ...result
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = RelatorioController;
