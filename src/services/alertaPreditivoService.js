const AlertaModel = require("../models/alertaModel");
const HistoricoIntegridadeModel = require("../models/historicoIntegridadeModel");
const MaquinaModel = require("../models/maquinaModel");
const PredicaoService = require("./predicaoService");
const AppError = require("../utils/appErrorUtils");

class AlertaPreditivoService {
  static TIPOS_SUPORTADOS = ["INSTABILIDADE", "TENDENCIA_CURTA", "TENDENCIA_LONGA"];
  static MIN_AMOSTRAS_LIMIAR = 3;

  static arredondar(valor, casas = 2) {
    return Number(Number(valor).toFixed(casas));
  }

  static calcularMediana(valores) {
    if (!valores.length) return null;

    const ordenados = [...valores].sort((a, b) => a - b);
    const meio = Math.floor(ordenados.length / 2);

    if (ordenados.length % 2 === 0) {
      return (ordenados[meio - 1] + ordenados[meio]) / 2;
    }

    return ordenados[meio];
  }

  static calcularConfianca(r2, amostrasLimiar) {
    const base = Math.min(1, Number(r2) || 0);
    const penalidadeAmostras = Math.min(1, (Number(amostrasLimiar) || 0) / 10);
    return this.arredondar(Math.min(1, base * penalidadeAmostras), 2);
  }

  static resumirModeloIntegridade(modeloResultado) {
    if (!modeloResultado?.modeloIntegridade) {
      return null;
    }

    const { score, slope, intercept, pontosUsados } = modeloResultado.modeloIntegridade;

    return {
      r2: this.arredondar(score.r2, 2),
      slope: this.arredondar(slope, 4),
      intercept: this.arredondar(intercept, 2),
      pontosUsados
    };
  }

  static async coletarAmostrasIntegridade(alertas) {
    const resultados = await Promise.all(
      alertas.map(async (alerta) => {
        const historico = await HistoricoIntegridadeModel.findLatestBefore(alerta.maquinaId, alerta.criadoEm);
        return historico ? Number(historico.integridade) : null;
      })
    );

    return resultados.filter((integridade) => Number.isFinite(integridade));
  }

  static async calcularLimiarHistoricoPorAlertas(alertas) {
    if (!Array.isArray(alertas) || alertas.length === 0) {
      return null;
    }

    const amostras = await this.coletarAmostrasIntegridade(alertas);
    if (amostras.length < this.MIN_AMOSTRAS_LIMIAR) {
      return null;
    }

    return {
      integridadeLimiar: this.calcularMediana(amostras),
      amostrasLimiar: amostras.length
    };
  }

  static async obterLimiarHistorico(maquina, tipo) {
    const escopos = [
      {
        fonteLimiar: "MAQUINA",
        buscarAlertas: () => AlertaModel.findByMaquinaAndTipos(maquina.id, [tipo])
      },
      {
        fonteLimiar: "TIPO_MAQUINA",
        buscarAlertas: () => AlertaModel.findByTipoMaquinaAndTipos(maquina.tipo, [tipo])
      },
      {
        fonteLimiar: "GLOBAL",
        buscarAlertas: () => AlertaModel.findByTipos([tipo])
      }
    ];

    for (const escopo of escopos) {
      const alertas = await escopo.buscarAlertas();
      const limiar = await this.calcularLimiarHistoricoPorAlertas(alertas);

      if (limiar) {
        return {
          ...limiar,
          fonteLimiar: escopo.fonteLimiar
        };
      }
    }

    return null;
  }

  static montarPredicaoTipo(tipo, dataPrevista, limiarHistorico, modeloIntegridade) {
    return {
      tipo,
      dataPrevista,
      integridadeLimiar: this.arredondar(limiarHistorico.integridadeLimiar, 2),
      confianca: this.calcularConfianca(modeloIntegridade.score.r2, limiarHistorico.amostrasLimiar),
      fonteLimiar: limiarHistorico.fonteLimiar,
      amostrasLimiar: limiarHistorico.amostrasLimiar
    };
  }

  static montarPredicaoInstabilidade(predicaoTipo) {
    if (!predicaoTipo) return null;

    return {
      dataPrevista: predicaoTipo.dataPrevista,
      integridadeLimiar: predicaoTipo.integridadeLimiar,
      confianca: predicaoTipo.confianca,
      fonteLimiar: predicaoTipo.fonteLimiar,
      amostrasLimiar: predicaoTipo.amostrasLimiar
    };
  }

  static async preverTipo(maquina, tipo, modeloResultado) {
    if (!modeloResultado?.valido || !modeloResultado?.modeloIntegridade) {
      return null;
    }

    const limiarHistorico = await this.obterLimiarHistorico(maquina, tipo);
    if (!limiarHistorico) {
      return null;
    }

    const modeloIntegridade = modeloResultado.modeloIntegridade;
    const dataPrevista = PredicaoService.projetarDataLimiar(
      modeloIntegridade,
      limiarHistorico.integridadeLimiar,
      modeloIntegridade.dataBase
    );

    if (!dataPrevista || dataPrevista <= modeloIntegridade.referenciaTemporal) {
      return null;
    }

    return this.montarPredicaoTipo(tipo, dataPrevista, limiarHistorico, modeloIntegridade);
  }

  static async preverPorMaquina(maquinaId) {
    const maquina = await MaquinaModel.findById(maquinaId);
    if (!maquina) {
      throw new AppError("Maquina nao encontrada.", 404);
    }

    const modeloResultado = await PredicaoService.obterModeloIntegridade(maquinaId);
    const modeloIntegridade = this.resumirModeloIntegridade(modeloResultado);

    if (!modeloResultado?.valido) {
      return {
        maquinaId: maquina.id,
        proximoAlerta: null,
        instabilidade: null,
        modeloIntegridade
      };
    }

    const previsoes = await Promise.all(
      this.TIPOS_SUPORTADOS.map((tipo) => this.preverTipo(maquina, tipo, modeloResultado))
    );

    const previsoesValidas = previsoes.filter(Boolean);
    const proximoAlerta = previsoesValidas.length
      ? [...previsoesValidas].sort((a, b) => a.dataPrevista - b.dataPrevista)[0]
      : null;

    const instabilidade = this.montarPredicaoInstabilidade(
      previsoesValidas.find((predicao) => predicao.tipo === "INSTABILIDADE") || null
    );

    return {
      maquinaId: maquina.id,
      proximoAlerta,
      instabilidade,
      modeloIntegridade
    };
  }
}

module.exports = AlertaPreditivoService;
