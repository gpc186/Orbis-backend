const leituraModel = require("../models/leituraModel");
const SensorModel = require("../models/sensorModel");
const AppError = require("../utils/appErrorUtils");
const AlertaService = require("../services/alertaService");
const PredicaoService = require("./predicaoService");
const logger = require("../utils/logger");

class leituraService {
  static async processarNovaLeitura(dadosLeitura) {
    try {
      const sensor = await SensorModel.findById(dadosLeitura.sensorId);
      if (!sensor) {
        throw new AppError("Sensor nao encontrado", 404);
      }

      if (dadosLeitura.temperatura > sensor.limiteTemperatura) {
        await AlertaService.gerarAlerta(
          sensor.id,
          sensor.maquinaId,
          "LIMITE_ULTRAPASSADO",
          `Temperatura Critica: ${dadosLeitura.temperatura}°C (Limite: ${sensor.limiteTemperatura}°C)`
        );
      }

      if (dadosLeitura.vibracao > sensor.limiteVibracao) {
        await AlertaService.gerarAlerta(
          sensor.id,
          sensor.maquinaId,
          "LIMITE_ULTRAPASSADO",
          `Vibracao Critica: ${dadosLeitura.vibracao} (Limite: ${sensor.limiteVibracao})`
        );
      }

      const desvioTemp = Math.abs(dadosLeitura.temperatura - sensor.idealTemperatura);
      const desvioVibra = Math.abs(dadosLeitura.vibracao - sensor.idealVibracao);

      if (desvioTemp > sensor.desvioMaximoTemp || desvioVibra > sensor.desvioMaximoVibra) {
        await AlertaService.gerarAlerta(
          sensor.id,
          sensor.maquinaId,
          "INSTABILIDADE",
          "Oscilacao termica ou da vibracao detectada fora do padrao ideal."
        );
      }

      const novaLeitura = await leituraModel.store(dadosLeitura);

      try {
        await PredicaoService.atualizarSaudeMaquina(sensor.maquinaId);
        await PredicaoService.previsaoManutencao(sensor.maquinaId);
      } catch (error) {
        logger.error("leitura_predictive_processing_failed", {
          sensorId: sensor.id,
          maquinaId: sensor.maquinaId,
          error
        });
      }

      return novaLeitura;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError("Erro ao processar nova leitura.", 500);
    }
  }

  static async index(limite = 20) {
    try {
      return await leituraModel.index(limite);
    } catch (error) {
      throw new AppError("Erro ao buscar leituras.", 500);
    }
  }
}

module.exports = leituraService;
