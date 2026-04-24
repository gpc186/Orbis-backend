const MaquinaModel = require('../models/maquinaModel');
const AppError = require("../utils/appErrorUtils")

class MaquinaService {
    static async create(dados) {
        if (!dados.nome || !dados.setor) {
            throw new AppError("Nome e setor são obrigatórios para cadastrar uma máquina.");
        }
        return await MaquinaModel.create(dados);
    }
    static async list() {
        return await MaquinaModel.findAll();
    }
    static async findById(id) {
        try {
            const maquina = await MaquinaModel.findById(id);
            if (!maquina) throw new AppError("Máquina não encontrada.", 404);
            return maquina;
        } catch (error) {
            throw new AppError("Erro ao buscar máquina.", 500);
        }
    }
    static async update(id, dados) {
        try {
            // Verifica se a máquina existe antes de tentar atualizar
            await this.findById(id);
            return await MaquinaModel.update(id, dados);
        } catch (error) {
            throw new AppError("Erro ao atualizar máquina.", 500);
        }
    }
    static async count(){
        try {
            return await MaquinaModel.count();
        } catch (error) {
            throw new AppError("Erro ao contar máquinas.", 500);
        }
    }
    static async calculateAverageIntegrity(){
        try {
            return await MaquinaModel.calculateAverageIntegrity()
        } catch (error) {
            throw new AppError("Erro ao calcular integridade média.", 500);
        }
    }
    static async delete(id) {
        try {
            const maquina = await MaquinaModel.findById(id);
            if (!maquina) throw new AppError("Máquina não encontrada.", 404);
            return await MaquinaModel.delete(id);
        } catch (error) {
            throw new AppError("Erro ao deletar máquina.", 500);
        }
    }
};

module.exports = MaquinaService;