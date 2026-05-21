const HistoricoIntegridadeModel = require('../models/historicoIntegridadeModel');
const MaquinaModel = require('../models/maquinaModel');
const AppError = require('../utils/appErrorUtils');

class HistoricoIntegridadeService {
    static normalizarLimite(limite) {
        const valor = Number(limite);

        if (!Number.isFinite(valor) || valor <= 0) {
            return 100;
        }

        return Math.min(Math.trunc(valor), 500);
    }

    static normalizarPercentual(valor, campo) {
        const numero = Number(valor);

        if (!Number.isFinite(numero) || numero < 0 || numero > 100) {
            throw new AppError(`${campo} deve ser um numero entre 0 e 100.`, 400);
        }

        return Number(numero.toFixed(2));
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
        const limite = this.normalizarLimite(filtros.limite);
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

        return await HistoricoIntegridadeModel.findAll({
            maquinaId: filtros.maquinaId,
            dataInicio,
            dataFim,
            limite
        });
    }

    static async listByMaquina(maquinaId, filtros = {}) {
        const maquina = await MaquinaModel.findById(maquinaId);

        if (!maquina) {
            throw new AppError("Maquina nao encontrada.", 404);
        }

        return await this.list({
            ...filtros,
            maquinaId
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
