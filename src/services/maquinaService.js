const MaquinaModel = require('../models/maquinaModel');
const AppError = require("../utils/appErrorUtils");
const StorageService = require('./storageService');

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
    static async updateFotoMaquina({ maquinaId, buffer }){
        const maquina = await MaquinaModel.findById(maquinaId);
        if(!maquina || maquina.ativo == false){
            throw new AppError("Maquina não encontrada ou desativada!", 404);
        };

        const { caminhoImagem, url } = await StorageService.uploadFotoMaquina({maquinaId, buffer});

        const id = maquinaId
        const data = {
            imagem: url,
            caminhoImagem
        }
        const maquinaAtualizada = await MaquinaModel.update(id, data);

        return maquinaAtualizada
    }
    static async count(){
        return await MaquinaModel.count();
    }
    static async calculateAverageIntegrity(){
        return await MaquinaModel.calculateAverageIntegrity()
    }
    static async delete(id) {
        return await MaquinaModel.delete(id);
    }
};

module.exports = MaquinaService;