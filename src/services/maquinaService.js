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
        const maquina = await MaquinaModel.findById(id);
        if (!maquina) throw new AppError("Máquina não encontrada.");
        return maquina;
    }
    static async update(id, dados) {
        // Verifica se a máquina existe antes de tentar atualizar
        await this.findById(id);
        return await MaquinaModel.update(id, dados);
    }
    static async delete(id) {
        return await MaquinaModel.delete(id);
    }
};

module.exports = MaquinaService;