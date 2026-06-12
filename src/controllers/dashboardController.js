const DashboardService = require("../services/dashboardService");

class DashboardController {
    static async resume(req, res, next) {
        try {
            const resumo = await DashboardService.resume();
            return res.status(200).json(resumo);
        } catch (error) {
            next(error);
        };
    };

    static async complete(req, res, next) {
        try {
            const dashboard = await DashboardService.complete({
                usuario: req.usuario,
                limit: req.query?.limit,
                listasLimit: req.query?.listasLimit
            });
            return res.status(200).json(dashboard);
        } catch (error) {
            next(error);
        };
    };
};

module.exports = DashboardController;
