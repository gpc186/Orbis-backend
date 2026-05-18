const AlertaService = require("../services/alertaService");

class AlertaController {
  static async summary(req, res, next) {
    try {
      const [maquinasEmAlerta, alertasAtivos, alertasHoje, alertaSemAtendimento, alertasAtendidosHoje] =
        await Promise.all([
          AlertaService.countMaquinasWithAlerta(),
          AlertaService.countActiveAlertas(),
          AlertaService.countAlertasToday(),
          AlertaService.countAlertaSemAtendimento(),
          AlertaService.countAtendedToday()
        ]);

      const resumo = {
        maquinasEmAlerta,
        alertasAtivos,
        alertasHoje,
        alertaSemAtendimento,
        alertasAtendidosHoje
      };

      return res.status(200).json(resumo);
    } catch (error) {
      next(error);
    }
  }

  static async list(req, res, next) {
    try {
      const alertas = await AlertaService.findAll();
      return res.status(200).json(alertas);
    } catch (error) {
      next(error);
    }
  }

  static async listEventos(req, res, next) {
    try {
      const eventos = await AlertaService.findAllEventos();
      return res.status(200).json(eventos);
    } catch (error) {
      next(error);
    }
  }

  static async listEventosByAlertaId(req, res, next) {
    try {
      const { id } = req.params;
      const eventos = await AlertaService.findEventosByAlertaId(id);
      return res.status(200).json(eventos);
    } catch (error) {
      next(error);
    }
  }

  static async findById(req, res, next) {
    try {
      const { id } = req.params;
      const alerta = await AlertaService.findById(id);
      return res.status(200).json(alerta);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AlertaController;
