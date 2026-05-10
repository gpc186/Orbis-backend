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
};

module.exports = DashboardController;