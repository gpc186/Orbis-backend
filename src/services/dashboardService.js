const AlertaService = require("../services/alertaService");
const MaquinaService = require("../services/maquinaService");
const SensorService = require("../services/sensorService");
const UsuarioService = require("../services/usuarioService");
const ManutencaoService = require("../services/manutencaoService");
const AlertaModel = require("../models/alertaModel");
const MaquinaModel = require("../models/maquinaModel");
const SensorModel = require("../models/sensorModel");
const { normalizeLimit } = require("../utils/requestParsers");
const { attachSlaToMany } = require("./alertaSlaService");

class DashboardService {
    static async resume() {
        const [totalMaquinas, maquinasEmAlerta, alertasAtivos, alertasHoje, tecnicosAtivos, integridadeMedia, sensoresOnline, alertaSemAtendimento, alertasAtendidosHoje, slaResumo] = await Promise.all([
            MaquinaService.count(),
            AlertaService.countMaquinasWithAlerta(),
            AlertaService.countActiveAlertas(),
            AlertaService.countAlertasToday(),
            UsuarioService.countActiveTecnicos(),
            MaquinaService.calculateAverageIntegrity(),
            SensorService.countActive(),
            AlertaService.countAlertaSemAtendimento(),
            AlertaService.countAtendedToday(),
            AlertaService.getSlaSummary()
        ]);
         
        return { totalMaquinas, maquinasEmAlerta, maquinasFuncionando: totalMaquinas - maquinasEmAlerta, alertasAtivos, alertasHoje, tecnicosAtivos, integridadeMedia: integridadeMedia._avg.integridade, sensoresOnline, alertaSemAtendimento, alertasAtendidosHoje, ...slaResumo }
    }

    static buildDestaquesFromResumo(resumo = {}) {
        const destaques = [];

        if ((resumo.alertasAtivos || 0) > 0) {
            destaques.push(`${resumo.alertasAtivos} alertas ativos no momento.`);
        }
        if ((resumo.maquinasEmAlerta || 0) > 0) {
            destaques.push(`${resumo.maquinasEmAlerta} maquinas em alerta.`);
        }
        if ((resumo.alertaSemAtendimento || 0) > 0) {
            destaques.push(`${resumo.alertaSemAtendimento} alertas sem atendimento.`);
        }

        return destaques;
    }

    static async getTopAlertas({ limit = 5 } = {}) {
        const safeLimit = normalizeLimit(limit, 5);
        const alertas = await AlertaModel.listTopAtivos({ limit: safeLimit });
        return attachSlaToMany(alertas, { stripSources: true });
    }

    static async getMaquinasCriticas({ limit = 5 } = {}) {
        const safeLimit = normalizeLimit(limit, 5);
        return MaquinaModel.listPioresIntegridade({ limit: safeLimit });
    }

    static async getSensoresOffline({ limit = 5 } = {}) {
        const safeLimit = normalizeLimit(limit, 5);
        return SensorModel.listOfflineRecentes({ limit: safeLimit });
    }

    static async getDestaques({ resumo } = {}) {
        const resumoAtual = resumo || await this.resume();
        return this.buildDestaquesFromResumo(resumoAtual);
    }

    static async getOperationalContext({ limit = 5 } = {}) {
        const resumo = await this.resume();
        const [topAlertas, maquinasCriticas, sensoresOffline] = await Promise.all([
            this.getTopAlertas({ limit }),
            this.getMaquinasCriticas({ limit }),
            this.getSensoresOffline({ limit })
        ]);

        return {
            resumo,
            topAlertas,
            maquinasCriticas,
            sensoresOffline,
            destaques: this.buildDestaquesFromResumo(resumo)
        };
    }

    static async complete({ usuario, limit = 5, listasLimit = 20 } = {}) {
        const safeLimit = normalizeLimit(limit, 5);
        const safeListasLimit = normalizeLimit(listasLimit, 20);
        const resumo = await this.resume();

        const [
            topAlertas,
            alertasAtivos,
            maquinasCriticas,
            maquinas,
            sensoresOffline,
            sensores,
            manutencoes
        ] = await Promise.all([
            this.getTopAlertas({ limit: safeLimit }),
            AlertaService.findAtivos({ limit: safeListasLimit }),
            this.getMaquinasCriticas({ limit: safeLimit }),
            MaquinaService.list(),
            this.getSensoresOffline({ limit: safeLimit }),
            SensorService.list(),
            ManutencaoService.list({
                page: 1,
                limit: safeListasLimit,
                usuario
            })
        ]);

        return {
            generatedAt: new Date().toISOString(),
            limites: {
                destaques: safeLimit,
                listas: safeListasLimit
            },
            resumo,
            destaques: this.buildDestaquesFromResumo(resumo),
            alertas: {
                topAtivos: topAlertas,
                ativos: alertasAtivos
            },
            maquinas: {
                criticas: maquinasCriticas,
                lista: MaquinaService.sanitizeForResponse(maquinas)
            },
            sensores: {
                offline: sensoresOffline,
                lista: sensores
            },
            manutencoes
        };
    }
}

module.exports = DashboardService
