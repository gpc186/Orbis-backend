const DashboardAiService = require("../services/dashboardAiService");

class DashboardAiController {
  static async perguntar(req, res, next) {
    try {
      const { pergunta, historico, confirmationResponse } = req.body;
      const usuario = req.usuario;
      const result = await DashboardAiService.answer({
        pergunta,
        usuario,
        historico,
        confirmationResponse
      });
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = DashboardAiController;
