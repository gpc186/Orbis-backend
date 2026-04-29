const AlertaService = require('../services/alertaService');
const AppError = require('../utils/appErrorUtils');

class AlertaController {
    static async summary(req, res, next) {
        try {
            const [maquinasEmAlerta, alertasAtivos, alertasHoje, alertaSemAtendimento, alertasAtendidosHoje] = await Promise.all([
                AlertaService.countMaquinasWithAlerta(),
                AlertaService.countActiveAlertas(),
                AlertaService.countAlertasToday(),
                AlertaService.countAlertaSemAtendimento(),
                AlertaService.countAtendedToday()
            ]);
            const resumo = { maquinasEmAlerta, alertasAtivos, alertasHoje, alertaSemAtendimento, alertasAtendidosHoje };
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

    static async findById(req, res, next) {
        try {
            const { id } = req.params;
            const alerta = await AlertaService.findById(id);

            if (!alerta) {
                throw new AppError('Alerta não encontrada!', 404);
            }

            return res.status(200).json(alerta);
        } catch (error) {
            next(error);
        }
    }
}

module.exports = AlertaController;
