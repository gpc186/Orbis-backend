const SensorModel = require('../models/sensorModel');
const MaquinaModel = require('../models/maquinaModel');
const AppError = require("../utils/appErrorUtils")

class SensorService {
    static async create(dados) {
        // Validação crucial: A máquina pai existe?
        const maquinaExiste = await MaquinaModel.findById(dados.maquinaId);
        if (!maquinaExiste) {
            throw new AppError("Não é possível criar o sensor: Máquina selecionada não existe.");
        }

        // Garante que os limites sejam números
        const dadosFormatados = {
            ...dados,
            limiteTemperatura: parseFloat(dados.limiteTemperatura) || 0,
            limiteVibracao: parseFloat(dados.limiteVibracao) || 0,
            maquinaId: parseInt(dados.maquinaId)
        };

        return await SensorModel.create(dadosFormatados);
    }
    static async list() {
        return await SensorModel.findAll();
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

            // Se o maquinaId mudou, o model vai tratar no connect
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
        return await SensorModel.countActiveSensors()
    }
};

module.exports = SensorService;