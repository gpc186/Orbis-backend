const MaquinaModel = require("../models/maquinaModel");
const AppError = require("../utils/appErrorUtils");
const StorageService = require("./storageService");
const MaquinaManualService = require("./maquinaManualService");

class MaquinaService {
  static sanitizeManualForResponse(manual) {
    if (!manual) return manual;

    const {
      textoExtraido,
      embedding,
      chunks,
      caminho,
      ...manualPublico
    } = manual;

    return manualPublico;
  }

  static sanitizeForResponse(maquina) {
    if (!maquina) return maquina;

    if (Array.isArray(maquina)) {
      return maquina.map((item) => this.sanitizeForResponse(item));
    }

    return {
      ...maquina,
      manual: this.sanitizeManualForResponse(maquina.manual)
    };
  }

  static async create(dados, manualFile = null) {
    if (!dados.nome || !dados.setor) {
      throw new AppError("Nome e setor sao obrigatorios para cadastrar uma maquina.", 400);
    }

    const maquinaData = this.formatCreateData(dados);
    let manualData = null;

    if (manualFile) {
      manualData = await MaquinaManualService.buildManualData({
        file: manualFile,
        maquina: maquinaData,
        caminhoPrefixo: "maquinas/pendentes"
      });
      maquinaData.manual = { create: manualData };
    }

    try {
      return await MaquinaModel.create(maquinaData);
    } catch (error) {
      if (manualData?.caminho) {
        await StorageService.deleteArquivo({
          bucket: "machine-manuals",
          caminho: manualData.caminho
        }).catch(() => {});
      }
      throw error;
    }
  }

  static formatCreateData(dados) {
    const data = {
      nome: String(dados.nome || "").trim(),
      setor: String(dados.setor || "").trim(),
      tipo: String(dados.tipo || "").trim()
    };

    if (!data.tipo) {
      throw new AppError("Tipo e obrigatorio para cadastrar uma maquina.", 400);
    }

    if (dados.criticidade !== undefined) data.criticidade = dados.criticidade;
    if (dados.ativo !== undefined) data.ativo = dados.ativo === true || dados.ativo === "true";
    if (dados.integridade !== undefined) data.integridade = this.parseOptionalNumber(dados.integridade, "integridade");
    if (dados.scoreEstabilidade !== undefined) {
      data.scoreEstabilidade = this.parseOptionalNumber(dados.scoreEstabilidade, "scoreEstabilidade");
    }
    if (dados.previsaoManutencao) data.previsaoManutencao = new Date(dados.previsaoManutencao);
    if (dados.janelaManuInicio) data.janelaManuInicio = new Date(dados.janelaManuInicio);
    if (dados.janelaManuFim) data.janelaManuFim = new Date(dados.janelaManuFim);

    return data;
  }

  static parseOptionalNumber(value, campo) {
    const parsed = parseFloat(value);
    if (!Number.isFinite(parsed)) {
      throw new AppError(`${campo} deve ser um numero valido.`, 400);
    }
    return parsed;
  }

  static async list() {
    return await MaquinaModel.findAll();
  }

  static async findById(id) {
    try {
      const maquina = await MaquinaModel.findById(id, { include: { manual: true, sensores: true } });
      if (!maquina) throw new AppError("Maquina nao encontrada.", 404);
      return maquina;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Erro ao buscar maquina.", 500);
    }
  }

  static async update(id, dados) {
    try {
      const maquina = await this.findById(id);
      const dadosParaAtualizar = { ...dados };

      if (dados.ativo === false || dados.ativo === "false") {
        dadosParaAtualizar.ativo = false;
        dadosParaAtualizar.imagem = null;
        dadosParaAtualizar.caminhoImagem = null;
      }

      const maquinaAtualizada = await MaquinaModel.update(id, dadosParaAtualizar);

      if (dadosParaAtualizar.ativo === false && maquina.caminhoImagem) {
        await StorageService.deleteFoto({
          bucket: "machine-images",
          caminho: maquina.caminhoImagem
        }).catch((error) => console.error("Falha ao remover imagem antiga:", error));
      }

      return maquinaAtualizada;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Erro ao atualizar maquina.", 500);
    }
  }

  static async updateFotoMaquina({ maquinaId, buffer }) {
    const maquina = await this.findById(maquinaId);

    if (!maquina || maquina.ativo == false) {
      throw new AppError("Maquina nao encontrada ou desativada!", 404);
    }

    let uploadResult = null;
    const caminho = `maquina/${maquina.id}/maquina-${Date.now()}.webp`;
    const bucket = "machine-images";

    try {
      uploadResult = await StorageService.uploadFoto({ bucket, caminho, buffer });
      const maquinaAtualizada = await MaquinaModel.update(maquinaId, {
        imagem: uploadResult.url,
        caminhoImagem: uploadResult.caminhoImagem
      });

      if (maquina.caminhoImagem) {
        await StorageService.deleteFoto({
          bucket: "machine-images",
          caminho: maquina.caminhoImagem
        }).catch((error) => console.error("Nao foi possivel deletar a imagem antiga!", error));
      }

      return maquinaAtualizada;
    } catch (error) {
      if (uploadResult?.caminhoImagem) {
        await StorageService.deleteFoto({
          bucket: "machine-images",
          caminho: uploadResult.caminhoImagem
        }).catch((errorDelete) => console.error("Nao foi possivel deletar a imagem antiga!", errorDelete));
      }
      throw error;
    }
  }

  static async updateManualMaquina({ maquinaId, file }) {
    if (!file) {
      throw new AppError("Manual nao enviado!", 400);
    }

    const maquina = await this.findById(maquinaId);

    if (!maquina || maquina.ativo == false) {
      throw new AppError("Maquina nao encontrada ou desativada!", 404);
    }

    const manualData = await MaquinaManualService.buildManualData({
      file,
      maquina: {
        id: maquina.id,
        nome: maquina.nome,
        setor: maquina.setor,
        tipo: maquina.tipo,
        criticidade: maquina.criticidade
      },
      caminhoPrefixo: `maquinas/${maquina.id}/manual`
    });

    try {
      const manual = await MaquinaModel.upsertManual(maquina.id, manualData);

      if (maquina.manual?.caminho) {
        await StorageService.deleteArquivo({
          bucket: "machine-manuals",
          caminho: maquina.manual.caminho
        }).catch(() => {});
      }

      return manual;
    } catch (error) {
      if (manualData?.caminho) {
        await StorageService.deleteArquivo({
          bucket: "machine-manuals",
          caminho: manualData.caminho
        }).catch(() => {});
      }
      throw error;
    }
  }

  static async previewManualSpecs({ maquinaId = null, file }) {
    let maquina = null;

    if (maquinaId !== null && maquinaId !== undefined && String(maquinaId).trim() !== "") {
      maquina = await this.findById(maquinaId);
    }

    return MaquinaManualService.previewSpecs({
      file,
      maquina: maquina
        ? {
            id: maquina.id,
            nome: maquina.nome,
            setor: maquina.setor,
            tipo: maquina.tipo,
            criticidade: maquina.criticidade
          }
        : null
    });
  }

  static async count() {
    return await MaquinaModel.count();
  }

  static async calculateAverageIntegrity() {
    return await MaquinaModel.calculateAverageIntegrity();
  }

  static async delete(id) {
    const maquina = await this.findById(id);
    if (!maquina) throw new AppError("Maquina nao encontrada.", 404);

    await MaquinaModel.delete(id);

    if (maquina.caminhoImagem) {
      await StorageService.deleteFoto({
        bucket: "machine-images",
        caminho: maquina.caminhoImagem
      }).catch((error) => console.error("Falha ao remover arquivo orfao:", error));
    }

    return { mensagem: "Maquina deletada com sucesso!" };
  }
}
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
