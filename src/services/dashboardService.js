const AlertaService = require("../services/alertaService");
const MaquinaService = require("../services/maquinaService");
const SensorService = require("../services/sensorService");
const UsuarioService = require("../services/usuarioService");

class DashboardService {
    static async resume() {
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
         
        return { totalMaquinas, maquinasEmAlerta, maquinasFuncionando: totalMaquinas - maquinasEmAlerta, alertasAtivos, alertasHoje, tecnicosAtivos, integridadeMedia: integridadeMedia._avg.integridade, sensoresOnline, alertaSemAtendimento, alertasAtendidosHoje }
    }
}

module.exports = DashboardService