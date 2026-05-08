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
            throw new AppError("Erro ao buscar sensor.", 500);
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
            throw new AppError("Erro ao atualizar sensor.", 500);
        }
    }
    static async delete(id) {
        try {
            const sensor = await SensorModel.findById(id);
            if (!sensor) throw new AppError("Sensor não encontrado.", 404);
            return await SensorModel.delete(id);
        } catch (error) {
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
};

module.exports = SensorService;
