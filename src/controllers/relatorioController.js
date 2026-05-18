const RelatorioExecucaoService = require("../services/relatorioExecucaoService");

class RelatorioController {
  static async enviarAgora(req, res, next) {
    try {
      const { emailsDestino, assunto, nome, periodo, filtros } = req.body;
      const { usuario } = req;

      const result = await RelatorioExecucaoService.executarManual({
        usuario,
        payload: { emailsDestino, assunto, nome, periodo, filtros }
      });

      return res.status(200).json({ message: "Relatorio enviado com sucesso.", ...result });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = RelatorioController;
