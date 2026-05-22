const MaquinaModel = require('../models/maquinaModel');
const AppError = require("../utils/appErrorUtils");
const StorageService = require('./storageService');
const AlertaPreditivoService = require('./alertaPreditivoService');
const PredicaoRiscoService = require('./predicaoRiscoService');

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
    static async getPredicaoAlertas(id) {
        try {
            return await AlertaPreditivoService.preverPorMaquina(id);
        } catch (error) {
            if (error instanceof AppError) throw error;
            throw new AppError("Erro ao calcular predicao de alertas.", 500);
        }
    }
    static async getPredicaoRisco(id) {
        try {
            return await PredicaoRiscoService.preverPorMaquina(id);
        } catch (error) {
            if (error instanceof AppError) throw error;
            throw new AppError("Erro ao calcular predicao de risco.", 500);
        }
    }
    static async findDetalhadaById(id) {
        try {
            const maquina = await MaquinaModel.findById(id, {
                include: {
                    sensores: true,
                    alertas: {
                        where: { status: "ATIVO" },
                        orderBy: { criadoEm: "desc" },
                        take: 10,
                        include: {
                            sensor: {
                                select: {
                                    id: true,
                                    tipo: true,
                                    status: true
                                }
                            },
                            tecnico: {
                                select: {
                                    id: true,
                                    nome: true,
                                    email: true,
                                    role: true,
                                    ativo: true
                                }
                            }
                        }
                    }
                }
            });

            if (!maquina) throw new AppError("MÃ¡quina nÃ£o encontrada.", 404);
            return maquina;
        } catch (error) {
            if (error instanceof AppError) throw error;
            throw new AppError("Erro ao buscar mÃ¡quina detalhada.", 500);
        }
    }
    static async findByNome({ nome, limit = 10, somenteAtivas }) {
        const nomeNormalizado = String(nome || "").trim();

        if (nomeNormalizado.length < 2) {
            throw new AppError("Nome invalido para busca de maquina.", 400);
        }

        const take = Math.min(Math.max(Number(limit || 10), 1), 20);

        try {
            const maquinas = await MaquinaModel.findByNome({
                nome: nomeNormalizado,
                take,
                ativo: typeof somenteAtivas === "boolean" ? somenteAtivas : undefined
            });

            return {
                total: maquinas.length,
                dados: maquinas
            };
        } catch (error) {
            if (error instanceof AppError) throw error;
            throw new AppError("Erro ao buscar maquina por nome.", 500);
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
    static async listCriticas({ limit = 10 } = {}) {
        const take = Math.min(Math.max(Number(limit || 10), 1), 20);

        return await MaquinaModel.listPioresIntegridade({ limit: take });
    }
    static async findComAlertaAtivo({ limit = 10 } = {}) {
        const take = Math.min(Math.max(Number(limit || 10), 1), 20);

        return await MaquinaModel.findComAlertaAtivo({ limit: take });
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
