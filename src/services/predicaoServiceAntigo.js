const AppError = require("../utils/appErrorUtils");

class PredicaoServiceAntigo {
  static LOOKBACK_HORAS = 24;
  static MIN_INTERVALO_HORAS = 0.05;
  static LIMITE_MAXIMO_DIAS_PREVISAO = 90;
  static LIMIAR_MANUTENCAO = 70;
  static LIMIAR_FALHA = 30;
  static R2_EQUIVALENTE = 0.7;

  static getEnvNumber(name, fallback, { min = null, integer = false } = {}) {
    const parsed = Number(process.env[name]);

    if (!Number.isFinite(parsed)) return fallback;

    const normalized = integer ? Math.trunc(parsed) : parsed;

    if (min !== null && normalized < min) {
      return fallback;
    }

    return normalized;
  }

  static obterConfig() {
    return {
      lookbackHoras: this.getEnvNumber(
        "PREDICAO_FALLBACK_ANTIGO_LOOKBACK_HORAS",
        this.LOOKBACK_HORAS,
        { min: 1 }
      ),
      minIntervaloHoras: this.getEnvNumber(
        "PREDICAO_FALLBACK_ANTIGO_MIN_INTERVALO_HORAS",
        this.MIN_INTERVALO_HORAS,
        { min: 0 }
      ),
      limiteMaximoDiasPrevisao: this.getEnvNumber(
        "PREDICAO_FALLBACK_ANTIGO_LIMITE_MAXIMO_DIAS",
        this.LIMITE_MAXIMO_DIAS_PREVISAO,
        { min: 1 }
      ),
      r2Equivalente: this.getEnvNumber(
        "PREDICAO_FALLBACK_ANTIGO_R2_EQUIVALENTE",
        this.R2_EQUIVALENTE,
        { min: 0 }
      ),
      pontosEquivalentes: this.getEnvNumber(
        "PREDICAO_FALLBACK_ANTIGO_PONTOS_EQUIVALENTES",
        2,
        { min: 2, integer: true }
      )
    };
  }

  static calcularHealthScore(sensor) {
    const temp = sensor.temperatura || sensor.ultimaTemperatura || 0;
    const vibra = sensor.vibracao || sensor.ultimaVibracao || 0;

    const diffTemp = (sensor.limiteTemperatura - sensor.idealTemperatura) || 1;
    const diffVibra = (sensor.limiteVibracao - sensor.idealVibracao) || 1;

    let scoreTemp = 1 - ((temp - sensor.idealTemperatura) / diffTemp);
    let scoreVibra = 1 - ((vibra - sensor.idealVibracao) / diffVibra);

    scoreTemp = Math.max(0, Math.min(1, scoreTemp));
    scoreVibra = Math.max(0, Math.min(1, scoreVibra));

    const total = ((scoreTemp * 0.4) + (scoreVibra * 0.6)) * 100;
    return parseFloat(total.toFixed(2)) || 0;
  }

  static calcularScoreAtual(maquina, scoreHojeAtual) {
    if (scoreHojeAtual !== null && scoreHojeAtual !== undefined) {
      const scoreInformado = Number(scoreHojeAtual);
      if (Number.isFinite(scoreInformado)) {
        return scoreInformado;
      }
    }

    const integridadeAtual = Number(maquina?.integridade);
    if (Number.isFinite(integridadeAtual)) {
      return integridadeAtual;
    }

    return null;
  }

  static somarHoras(data, horas) {
    return new Date(data.getTime() + (horas * 60 * 60 * 1000));
  }

  static limitarDataPrevisao(data, referenciaTemporal, config) {
    if (!data) return null;

    const horasAteData = (data.getTime() - referenciaTemporal.getTime()) / (1000 * 60 * 60);
    if (!Number.isFinite(horasAteData) || horasAteData <= 0) return null;

    if (horasAteData > (config.limiteMaximoDiasPrevisao * 24)) {
      return null;
    }

    return data;
  }

  static calcularJanelaManutencao(dataInicioManutencao, dataFalha, referenciaTemporal) {
    let janelaManuInicio = dataInicioManutencao || referenciaTemporal;

    if (janelaManuInicio < referenciaTemporal) {
      janelaManuInicio = new Date(referenciaTemporal.getTime());
    }

    let janelaManuFim = dataFalha
      ? new Date(dataFalha.getTime())
      : new Date(janelaManuInicio.getTime());

    janelaManuFim.setDate(janelaManuFim.getDate() - 2);

    if (janelaManuFim < janelaManuInicio) {
      janelaManuFim = new Date(janelaManuInicio.getTime());
    }

    return {
      janelaManuInicio,
      janelaManuFim
    };
  }

  static montarAvaliacaoModelo({
    scoreOntem,
    scoreHoje,
    quedaPorHora,
    leituraBaseEm,
    referenciaTemporal,
    intervaloHoras,
    config
  }) {
    return {
      disponivel: true,
      valido: true,
      motivo: null,
      modeloIntegridade: {
        modelo: null,
        score: { r2: Math.min(Math.max(config.r2Equivalente, 0), 1) },
        slope: -quedaPorHora,
        intercept: scoreHoje,
        dataBase: referenciaTemporal,
        referenciaTemporal,
        pontosUsados: config.pontosEquivalentes,
        janelaHorasCoberta: intervaloHoras,
        ultimoPontoEm: referenciaTemporal,
        intervaloMedioHoras: intervaloHoras,
        irregularidadeIndice: 1,
        heuristica: "predicao_service_antigo",
        scoreOntem,
        scoreHoje,
        leituraBaseEm
      }
    };
  }

  static async diagnosticarFallback(maquinaId, { maquina = null, scoreHojeAtual = null, referenciaTemporal = new Date() } = {}) {
    try {
      const MaquinaModel = require("../models/maquinaModel");
      const LeituraModel = require("../models/leituraModel");
      const config = this.obterConfig();
      const maquinaAtual = maquina || await MaquinaModel.findById(maquinaId);

      if (!maquinaAtual) return null;

      const scoreHoje = this.calcularScoreAtual(maquinaAtual, scoreHojeAtual);
      if (!Number.isFinite(scoreHoje) || scoreHoje <= this.LIMIAR_MANUTENCAO) {
        return null;
      }

      const dataInicioBusca = new Date(
        referenciaTemporal.getTime() - (config.lookbackHoras * 60 * 60 * 1000)
      );
      const leituraBase = await LeituraModel.findUnique(maquinaId, dataInicioBusca);

      if (!leituraBase?.sensor || !leituraBase?.criadoEm) {
        return null;
      }

      const leituraBaseEm = new Date(leituraBase.criadoEm);
      if (Number.isNaN(leituraBaseEm.getTime()) || leituraBaseEm >= referenciaTemporal) {
        return null;
      }

      const intervaloHoras = (referenciaTemporal.getTime() - leituraBaseEm.getTime()) / (1000 * 60 * 60);
      if (!Number.isFinite(intervaloHoras) || intervaloHoras < config.minIntervaloHoras) {
        return null;
      }

      const scoreOntem = this.calcularHealthScore({ ...leituraBase.sensor, ...leituraBase });
      const quedaPeriodo = scoreOntem - scoreHoje;

      if (!Number.isFinite(quedaPeriodo) || quedaPeriodo <= 0) {
        return null;
      }

      const quedaPorHora = quedaPeriodo / intervaloHoras;
      if (!Number.isFinite(quedaPorHora) || quedaPorHora <= 0) {
        return null;
      }

      const horasAteManutencao = (scoreHoje - this.LIMIAR_MANUTENCAO) / quedaPorHora;
      const horasAteFalha = (scoreHoje - this.LIMIAR_FALHA) / quedaPorHora;
      const dataInicioManutencao = this.limitarDataPrevisao(
        this.somarHoras(referenciaTemporal, horasAteManutencao),
        referenciaTemporal,
        config
      );
      const dataFalha = this.limitarDataPrevisao(
        this.somarHoras(referenciaTemporal, horasAteFalha),
        referenciaTemporal,
        config
      );

      if (!dataInicioManutencao && !dataFalha) {
        return null;
      }

      const janela = this.calcularJanelaManutencao(dataInicioManutencao, dataFalha, referenciaTemporal);

      return {
        dataInicioManutencao,
        dataFalha,
        janelaManuInicio: janela.janelaManuInicio,
        janelaManuFim: janela.janelaManuFim,
        avaliacaoModelo: this.montarAvaliacaoModelo({
          scoreOntem,
          scoreHoje,
          quedaPorHora,
          leituraBaseEm,
          referenciaTemporal,
          intervaloHoras,
          config
        })
      };
    } catch (error) {
      throw new AppError("Erro ao calcular fallback antigo de previsao.", 500);
    }
  }

  static async previsaoManutencao(maquinaId, scoreHojeAtual = null) {
    try {
      const MaquinaModel = require("../models/maquinaModel");
      const diagnostico = await this.diagnosticarFallback(maquinaId, { scoreHojeAtual });

      if (!diagnostico) return null;

      return await MaquinaModel.update(maquinaId, {
        previsaoManutencao: diagnostico.dataInicioManutencao || diagnostico.dataFalha,
        janelaManuInicio: diagnostico.janelaManuInicio,
        janelaManuFim: diagnostico.janelaManuFim
      });
    } catch (error) {
      throw new AppError("Erro ao calcular previsao de manutencao.", 500);
    }
  }
}

module.exports = PredicaoServiceAntigo;
