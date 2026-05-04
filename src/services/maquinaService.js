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
        try {
            const maquina = await MaquinaModel.findById(id);
            if (!maquina) throw new AppError("Máquina não encontrada.", 404);
            return maquina;
        } catch (error) {
            if (error instanceof AppError) throw error;
            throw new AppError("Erro ao buscar máquina.", 500);
        }
    }
    static async update(id, dados) {
        try {
            // Verifica se a máquina existe antes de tentar atualizar
            const maquina = await this.findById(id);

            const dadosParaAtualizar = { ...dados };

            if (dados.ativo === false) {
                dadosParaAtualizar.imagem = null;
                dadosParaAtualizar.caminhoImagem = null;
            }

            const maquinaAtualizada = await MaquinaModel.update(id, dadosParaAtualizar);

            if (dados.ativo === false && maquina.caminhoImagem) {
                try {
                    await StorageService.deleteFoto({
                        bucket: "machine-images",
                        caminho: maquina.caminhoImagem
                    });
                } catch (error) {
                    console.error("Falha ao remover imagem antiga:", error);
                }
            }
            return maquinaAtualizada;
        } catch (error) {
            if (error instanceof AppError) throw error;
            throw new AppError("Erro ao atualizar máquina.", 500);
        }
    }
    static async updateFotoMaquina({ maquinaId, buffer }) {
        const maquina = await this.findById(maquinaId);

        if (!maquina || maquina.ativo == false) {
            throw new AppError("Maquina não encontrada ou desativada!", 404);
        };

        let uploadResult = null;

        const caminho = `maquina/${maquina.id}/maquina-${Date.now()}.webp`;
        const bucket = "machine-images";

        try {
            uploadResult = await StorageService.uploadFoto({ bucket, caminho, buffer });
            const id = maquinaId;
            const data = {
                imagem: uploadResult.url,
                caminhoImagem: uploadResult.caminhoImagem
            }

            const maquinaAtualizada = await MaquinaModel.update(id, data);

            if (maquina.caminhoImagem) {
                try {
                    await StorageService.deleteFoto({ bucket: "machine-images", caminho: maquina.caminhoImagem });
                } catch (errorDelete) {
                    console.error("Não foi possivel deletar a imagem antiga!", errorDelete);
                }
            };

            return maquinaAtualizada;
        } catch (error) {
            if (uploadResult?.caminhoImagem) {
                try {
                    await StorageService.deleteFoto({ bucket: "machine-images", caminho: uploadResult.caminhoImagem });
                } catch (errorDelete) {
                    console.error("Não foi possivel deletar a imagem antiga!", errorDelete)
                }
            }
            throw error;
        }
    }
    static async count() {
        return await MaquinaModel.count();
    }
    static async calculateAverageIntegrity() {
        return await MaquinaModel.calculateAverageIntegrity()
    }
    static async delete(id) {
        const maquina = await MaquinaModel.findById(id);
        if (!maquina) throw new AppError("Máquina não encontrada.", 404);

        await MaquinaModel.delete(id);

        if (maquina.caminhoImagem) {
            try {
                await StorageService.deleteFoto({
                    bucket: "machine-images",
                    caminho: maquina.caminhoImagem
                });
            } catch (error) {
                console.error("Falha ao remover arquivo órfão:", error);
            }
        }

        return { mensagem: "Máquina deletada com sucesso!" };
    }
};

module.exports = MaquinaService;
