const { Prisma } = require('@prisma/client');
const leituraModel = require('../models/leituraModel');
const SensorModel = require('../models/sensorModel');
const AppError = require('../utils/appErrorUtils');
const AlertaService = require('./alertaService');

class leituraService {
    static async processarNovaLeitura(dadosLeitura) {

        const sensor = await SensorModel.findById(dadosLeitura.sensorId)
        if(!sensor) throw new AppError("Sensor não encontrado");

        if (dadosLeitura.temperatura > sensor.limiteTemperatura) {
            await AlertaService.gerarAlerta(
                sensor.id,
                sensor.maquinaId,
                'LIMITE_ULTRAPASSADO',
                `Temperatura Crítica: ${dadosLeitura.temperatura}°C (Limite: ${sensor.limiteTemperatura}°C)`
            )
        }

        if (dadosLeitura.vibracao > sensor.limiteVibracao) {
            await AlertaService.gerarAlerta(
                sensor.id,
                sensor.maquinaId,
                'LIMITE_ULTRAPASSADO',
                `Vibração Crítica: ${dadosLeitura.vibracao} (Limite: ${sensor.limiteVibracao})`
            )
        }

        const desvioTemp = Math.abs(dadosLeitura.temperatura - sensor.idealTemperatura)
        const desvioVibra = Math.abs(dadosLeitura.vibracao - sensor.idealVibracao)

        if (desvioTemp > sensor.desvioMaximoTemp || desvioVibra > sensor.desvioMaximoVibra) {
            await AlertaService.gerarAlerta(
                sensor.id,
                sensor.maquinaId,
                'INSTABILIDADE',
                `Oscilação térmica ou da vibração detectada fora do padrão ideal.`
            )
        }

        return await leituraModel.store(dadosLeitura)
    }

    static async index(limite = 20) {
        return await leituraModel.index(limite)
    }
}



module.exports = leituraService