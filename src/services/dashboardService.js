const AlertaService = require("../services/alertaService");
const MaquinaService = require("../services/maquinaService");
const SensorService = require("../services/sensorService");
const UsuarioService = require("../services/usuarioService");
const ManutencaoService = require("../services/manutencaoService");
const LeituraService = require("../services/leituraService");
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

    static async completeTecnico({
        usuario,
        limit = 5,
        listasLimit = 20,
        usuariosLimit = 100,
        tecnicosLimit = 10
    } = {}) {
        const safeLimit = normalizeLimit(limit, 5);
        const safeListasLimit = normalizeLimit(listasLimit, 20);
        const safeUsuariosLimit = normalizeLimit(usuariosLimit, 100, { max: 100 });
        const safeTecnicosLimit = normalizeLimit(tecnicosLimit, 10);
        const tecnicoId = usuario?.id;

        const [
            tecnico,
            tecnicos,
            usuarios,
            alertasAtivos,
            alertasDoTecnico,
            manutencoes,
            maquinas,
            maquinasCriticas,
            sensores,
            sensoresOffline,
            leituras
        ] = await Promise.all([
            UsuarioService.findTecnicoById(tecnicoId),
            UsuarioService.listAllTecnicos({ page: 1, limit: safeTecnicosLimit }),
            UsuarioService.list({ page: 1, limit: safeUsuariosLimit }),
            AlertaService.findAtivos({ limit: safeListasLimit }),
            UsuarioService.findAlertasByTecnicoId(tecnicoId, { page: 1, limit: safeListasLimit }),
            ManutencaoService.list({ page: 1, limit: safeListasLimit, usuario }),
            MaquinaService.list(),
            this.getMaquinasCriticas({ limit: safeLimit }),
            SensorService.list(),
            this.getSensoresOffline({ limit: safeLimit }),
            LeituraService.index(safeListasLimit)
        ]);

        const manutencoesDados = Array.isArray(manutencoes?.dados) ? manutencoes.dados : [];
        const alertasAtivosDados = Array.isArray(alertasAtivos?.dados) ? alertasAtivos.dados : [];
        const alertasTecnicoDados = Array.isArray(alertasDoTecnico?.dados) ? alertasDoTecnico.dados : [];
        const sensoresDados = Array.isArray(sensores) ? sensores : [];
        const sensoresOfflineDados = Array.isArray(sensoresOffline?.dados)
            ? sensoresOffline.dados
            : (Array.isArray(sensoresOffline) ? sensoresOffline : []);
        const maquinasCriticasDados = Array.isArray(maquinasCriticas) ? maquinasCriticas : [];

        return {
            generatedAt: new Date().toISOString(),
            limites: {
                destaques: safeLimit,
                listas: safeListasLimit,
                usuarios: safeUsuariosLimit,
                tecnicos: safeTecnicosLimit
            },
            tecnico,
            resumo: {
                manutencoesAbertas: manutencoesDados.filter((item) => ["AGENDADA", "EM_ANDAMENTO"].includes(item.status)).length,
                manutencoesAgendadas: manutencoesDados.filter((item) => item.status === "AGENDADA").length,
                alertasAtivos: alertasAtivos?.total ?? alertasAtivosDados.length,
                alertasDoTecnico: alertasDoTecnico?.total ?? alertasTecnicoDados.length,
                sensoresOffline: sensoresOffline?.total ?? sensoresOfflineDados.length,
                maquinasCriticas: maquinasCriticasDados.length,
                sensoresTotal: sensoresDados.length,
                leiturasRecentes: Array.isArray(leituras) ? leituras.length : 0
            },
            alertas: {
                ativos: alertasAtivos,
                doTecnico: alertasDoTecnico
            },
            manutencoes,
            maquinas: {
                criticas: maquinasCriticas,
                lista: MaquinaService.sanitizeForResponse(maquinas)
            },
            sensores: {
                offline: sensoresOffline,
                lista: sensores
            },
            leiturasRecentes: Array.isArray(leituras) ? leituras : [],
            usuarios,
            tecnicos
        };
    }
}

module.exports = DashboardService
