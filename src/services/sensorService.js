const SensorModel = require('../models/sensorModel');
const MaquinaModel = require('../models/maquinaModel');
const AppError = require("../utils/appErrorUtils")

class SensorService {
    static async create(dados) {
        try {
            const maquinaId = parseInt(dados.maquinaId);
            if (!Number.isInteger(maquinaId)) {
                throw new AppError("maquinaId deve ser um numero inteiro valido.", 400);
            }

            const camposNumericosObrigatorios = [
                "limiteTemperatura",
                "idealTemperatura",
                "limiteVibracao",
                "idealVibracao"
            ];

            const dadosNumericos = {};
            for (const campo of camposNumericosObrigatorios) {
                const valor = parseFloat(dados[campo]);
                if (!Number.isFinite(valor)) {
                    throw new AppError(`${campo} e obrigatorio e deve ser um numero valido.`, 400);
                }
                dadosNumericos[campo] = valor;
            }
            // Validação crucial: A máquina pai existe?
            const maquinaExiste = await MaquinaModel.findById(maquinaId);
            if (!maquinaExiste) {
                throw new AppError("Não é possível criar o sensor: Máquina selecionada não existe.", 400);
            }

            // Garante que os limites sejam números
            const dadosFormatados = {
                ...dados,
                ...dadosNumericos,
                maquinaId
            };

            return await SensorModel.create(dadosFormatados);
        } catch (error) {
            if (error instanceof AppError) throw error;
            throw new AppError("Erro ao criar sensor.", 500);
        }
    }
    static async list() {
        try {
            return await SensorModel.findAll();
        } catch (error) {
            throw new AppError("Erro ao listar sensores.", 500);
        }
    }
    static async findById(id) {
        try {
            const sensor = await SensorModel.findById(id);
            if (!sensor) throw new AppError("Sensor não encontrado.", 404);
            return sensor;
        } catch (error) {
            if (error instanceof AppError) throw error;
            throw new AppError("Erro ao buscar sensor.", 500);
        }
    }
    static async findByTipo({ tipo, maquinaId, status, limit = 10 }) {
        const tipoNormalizado = String(tipo || "").trim();

        if (tipoNormalizado.length < 2) {
            throw new AppError("Tipo invalido para busca de sensor.", 400);
        }

        const take = Math.min(Math.max(Number(limit || 10), 1), 20);

        try {
            const sensores = await SensorModel.findByTipo({
                tipo: tipoNormalizado,
                maquinaId,
                status,
                take
            });

            return {
                total: sensores.length,
                dados: sensores
            };
        } catch (error) {
            if (error instanceof AppError) throw error;
            throw new AppError("Erro ao buscar sensores por tipo.", 500);
        }
    }
    static async findByMaquinaId({ maquinaId, status, limit = 10 }) {
        const maquinaIdNum = parseInt(maquinaId);

        if (!Number.isInteger(maquinaIdNum)) {
            throw new AppError("Id da maquina invalido para busca de sensores.", 400);
        }

        const take = Math.min(Math.max(Number(limit || 10), 1), 20);

        try {
            const maquina = await MaquinaModel.findById(maquinaIdNum);
            if (!maquina) {
                throw new AppError("Maquina nao encontrada.", 404);
            }

            const sensores = await SensorModel.findByMaquinaId({
                maquinaId: maquinaIdNum,
                status,
                take
            });

            return {
                total: sensores.length,
                dados: sensores
            };
        } catch (error) {
            if (error instanceof AppError) throw error;
            throw new AppError("Erro ao buscar sensores por maquina.", 500);
        }
    }
    static async update(id, dados) {
        try {
            // Verifica se o sensor existe
            const sensorExiste = await SensorModel.findById(id);
            if (!sensorExiste) throw new AppError("Sensor não encontrado.", 404);

            // Se maquinaId for null ou undefined, marca sensor como INATIVO
            if (!dados.maquinaId || dados.maquinaId === null || dados.maquinaId === undefined) {
                return await SensorModel.updateDisconnect(id, { ...dados, status: "INATIVO" });
            }

            // Valida se a nova máquina existe
            const maquinaExiste = await MaquinaModel.findById(dados.maquinaId);
            if (!maquinaExiste) {
                throw new AppError("Máquina selecionada não existe.", 400);
            }

            return await SensorModel.update(id, dados);
        } catch (error) {
            if (error instanceof AppError) throw error;
            throw new AppError("Erro ao atualizar sensor.", 500);
        }
    }
    static async delete(id) {
        try {
            const sensor = await SensorModel.findById(id);
            if (!sensor) throw new AppError("Sensor não encontrado.", 404);
            return await SensorModel.delete(id);
        } catch (error) {
            if (error instanceof AppError) throw error;
            throw new AppError("Erro ao deletar sensor.", 500);
        }
    }

    static async countActive(){
        try {
            return await SensorModel.countActiveSensors()
        } catch (error) {
            throw new AppError("Erro ao contar sensores ativos.", 500);
        }
    }
    static async listOfflineRecentes({ limit = 10 } = {}) {
        const take = Math.min(Math.max(Number(limit || 10), 1), 20);

        try {
            const sensores = await SensorModel.listOfflineRecentes({ limit: take });
            return {
                total: sensores.length,
                dados: sensores
            };
        } catch (error) {
            throw new AppError("Erro ao listar sensores offline.", 500);
        }
    }
};

module.exports = SensorService;
