const HistoricoIntegridadeModel = require('../models/historicoIntegridadeModel');
const MaquinaModel = require('../models/maquinaModel');
const AppError = require('../utils/appErrorUtils');

class HistoricoIntegridadeService {
    static PERIODOS_AGREGADOS = {
        "1d": { horas: 24, bucketMinutes: 5 },
        "3d": { horas: 72, bucketMinutes: 15 },
        "7d": { horas: 168, bucketMinutes: 60 }
    };

    static normalizarLimite(limite) {
        const valor = Number(limite);

        if (!Number.isFinite(valor) || valor <= 0) {
            return 100;
        }

        return Math.min(Math.trunc(valor), 500);
    }

    static normalizarPeriodo(periodo) {
        if (periodo === undefined || periodo === null || periodo === "") {
            return null;
        }

        const normalizado = String(periodo).trim().toLowerCase();

        if (!this.PERIODOS_AGREGADOS[normalizado]) {
            throw new AppError("periodo deve ser 1d, 3d ou 7d.", 400);
        }

        return normalizado;
    }

    static normalizarPercentual(valor, campo) {
        const numero = Number(valor);

        if (!Number.isFinite(numero) || numero < 0 || numero > 100) {
            throw new AppError(`${campo} deve ser um numero entre 0 e 100.`, 400);
        }

        return Number(numero.toFixed(2));
    }

    static normalizarBooleano(valor) {
        return [true, "true", "1", "sim", "yes"].includes(
            typeof valor === "string" ? valor.trim().toLowerCase() : valor
        );
    }

    static normalizarData(valor, campo) {
        if (!valor) {
            return undefined;
        }

        const data = new Date(valor);

        if (Number.isNaN(data.getTime())) {
            throw new AppError(`${campo} invalida.`, 400);
        }

        return data;
    }

    static calcularIntervaloPeriodo(periodo, { dataInicio, dataFim } = {}) {
        const config = this.PERIODOS_AGREGADOS[periodo];
        const fim = dataFim || new Date();
        const inicio = dataInicio || new Date(fim.getTime() - (config.horas * 60 * 60 * 1000));

        return {
            dataInicio: inicio,
            dataFim: fim,
            bucketMinutes: config.bucketMinutes
        };
    }

    static normalizarAgregado(row, bucketMinutes) {
        return {
            maquinaId: Number(row.maquinaId),
            integridade: Number(Number(row.integridade).toFixed(2)),
            scoreEstabilidade: row.scoreEstabilidade === null || row.scoreEstabilidade === undefined
                ? null
                : Number(Number(row.scoreEstabilidade).toFixed(2)),
            criadoEm: row.criadoEm,
            origem: row.origem || `AGREGADO_${bucketMinutes}M`
        };
    }

    static async create(dados) {
        const maquinaId = Number(dados.maquinaId);

        if (!Number.isInteger(maquinaId) || maquinaId <= 0) {
            throw new AppError("maquinaId invalido.", 400);
        }

        const maquina = await MaquinaModel.findById(maquinaId);

        if (!maquina) {
            throw new AppError("Maquina nao encontrada.", 404);
        }

        const integridade = this.normalizarPercentual(dados.integridade, "integridade");
        const scoreEstabilidade = dados.scoreEstabilidade === undefined || dados.scoreEstabilidade === null
            ? maquina.scoreEstabilidade
            : this.normalizarPercentual(dados.scoreEstabilidade, "scoreEstabilidade");

        return await HistoricoIntegridadeModel.create({
            maquinaId,
            integridade,
            scoreEstabilidade,
            origem: dados.origem || "REGISTRO_MANUAL",
            observacao: dados.observacao || null
        });
    }

    static async list(filtros = {}) {
        const periodo = this.normalizarPeriodo(filtros.periodo);
        const limite = this.normalizarLimite(filtros.limite ?? filtros.limit);
        const dataInicio = this.normalizarData(filtros.dataInicio, "dataInicio");
        const dataFim = this.normalizarData(filtros.dataFim, "dataFim");

        if (dataInicio && dataFim && dataInicio > dataFim) {
            throw new AppError("dataInicio nao pode ser maior que dataFim.", 400);
        }

        if (filtros.maquinaId !== undefined) {
            const maquinaId = Number(filtros.maquinaId);

            if (!Number.isInteger(maquinaId) || maquinaId <= 0) {
                throw new AppError("maquinaId invalido.", 400);
            }
        }

        if (periodo) {
            if (filtros.maquinaId === undefined) {
                throw new AppError("maquinaId invalido.", 400);
            }

            const intervalo = this.calcularIntervaloPeriodo(periodo, { dataInicio, dataFim });
            const agregados = await HistoricoIntegridadeModel.findAggregatedByMaquina(filtros.maquinaId, intervalo);

            return agregados.map((row) => this.normalizarAgregado(row, intervalo.bucketMinutes));
        }

        return await HistoricoIntegridadeModel.findAll({
            maquinaId: filtros.maquinaId,
            dataInicio,
            dataFim,
            limite,
            aposUltimaManutencao: this.normalizarBooleano(filtros.aposUltimaManutencao)
        });
    }

    static async listByMaquina(maquinaId, filtros = {}) {
        const maquina = await MaquinaModel.findById(maquinaId);

        if (!maquina) {
            throw new AppError("Maquina nao encontrada.", 404);
        }

        return await this.list({
            ...filtros,
            maquinaId,
            aposUltimaManutencao: !this.normalizarBooleano(filtros.incluirAntesManutencao)
        });
    }

    static async findById(id) {
        const historico = await HistoricoIntegridadeModel.findById(id);

        if (!historico) {
            throw new AppError("Historico de integridade nao encontrado.", 404);
        }

        return historico;
    }
}

module.exports = HistoricoIntegridadeService;
