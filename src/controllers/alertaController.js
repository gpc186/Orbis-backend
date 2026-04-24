const AlertaService = require('../services/alertaService');
const AppError = require('../utils/appErrorUtils');

class AlertaController {
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

    static async countMaquinasWithAlerta(req, res, next) {
        try {
            const maquinasEmAlerta = await AlertaService.countMaquinasWithAlerta();
            return res.status(200).json({ maquinasEmAlerta });
        } catch (error) {
            next(error);
        }
    }

    static async countActiveAlertas(req, res, next) {
        try {
            const alertasAtivos = await AlertaService.countActiveAlertas();
            return res.status(200).json({ alertasAtivos });
        } catch (error) {
            next(error);
        }
    }

    static async countAlertasToday(req, res, next) {
        try {
            const alertasHoje = await AlertaService.countAlertasToday();
            return res.status(200).json({ alertasHoje });
        } catch (error) {
            next(error);
        }
    }

    static async countAlertaSemAtendimento(req, res, next) {
        try {
            const alertaSemAtendimento = await AlertaService.countAlertaSemAtendimento();
            return res.status(200).json({ alertaSemAtendimento });
        } catch (error) {
            next(error);
        }
    }

    static async countAtendedToday(req, res, next) {
        try {
            const alertasAtendidosHoje = await AlertaService.countAtendedToday();
            return res.status(200).json({ alertasAtendidosHoje });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = AlertaController;
