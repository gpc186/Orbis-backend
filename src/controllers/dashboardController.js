const AlertaService = require("../services/alertaService");
const MaquinaService = require("../services/maquinaService");
const SensorService = require("../services/sensorService");
const UsuarioService = require("../services/usuarioService");

class DashboardController {
    static async resume(req, res, next) {
        try {
            const [totalMaquinas, maquinasEmAlerta, alertasAtivos, alertasHoje, tecnicosAtivos, integridadeMedia, sensoresOnline, alertaSemAtendimento, alertasAtendidosHoje] = await Promise.all([
                MaquinaService.count(),
                AlertaService.countMaquinasWithAlerta(),
                AlertaService.countActiveAlertas(),
                AlertaService.countAlertasToday(),
                UsuarioService.countActiveTecnicos(),
                MaquinaService.calculateAverageIntegrity(),
                SensorService.countActive(),
                AlertaService.countAlertaSemAtendimento(),
                AlertaService.countAtendedToday()
            ]);
            const resumo = {totalMaquinas, maquinasEmAlerta, maquinasFuncionando: totalMaquinas - maquinasEmAlerta, alertasAtivos, alertasHoje, tecnicosAtivos, integridadeMedia, sensoresOnline, alertaSemAtendimento, alertasAtendidosHoje}
            return res.status(200).json(resumo);
        } catch (error) {
            next(error);
        };
    };
};

module.exports = DashboardController;