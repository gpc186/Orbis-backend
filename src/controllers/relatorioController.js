const RelatorioService = require("../services/relatorioService");

class RelatorioController {
  static async enviarAgora(req, res, next) {
    try {
      const { body: { emailsDestino, assunto, nome, periodo, filtros }, usuario } = req;

      const result = await RelatorioService.enviarAgora({ usuario, emailsDestino, assunto, nome, periodo, filtros });
      return res.status(200).json({ message: "Relatório enviado com sucesso.", ...result });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = RelatorioController;
