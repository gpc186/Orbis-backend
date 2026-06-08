const AlertaModel = require("../models/alertaModel");
const HistoricoIntegridadeModel = require("../models/historicoIntegridadeModel");
const MaquinaModel = require("../models/maquinaModel");
const PredicaoService = require("./predicaoService");
const AppError = require("../utils/appErrorUtils");

class AlertaPreditivoService {
  static TIPOS_SUPORTADOS = ["INSTABILIDADE", "TENDENCIA_CURTA", "TENDENCIA_LONGA"];
  static MIN_AMOSTRAS_LIMIAR = 1;
  static LIMIARES_OPERACIONAIS = {
    INSTABILIDADE: 80,
    TENDENCIA_CURTA: 85,
    TENDENCIA_LONGA: 90
  };

  static MOTIVOS = {
    HISTORICO_INSUFICIENTE: "historico_insuficiente",
    REGRESSAO_INDISPONIVEL: "modelo_nao_pode_ser_calculado",
    MODELO_INVALIDO: "tendencia_nao_confiavel",
    JANELA_TEMPORAL_INSUFICIENTE: "janela_temporal_insuficiente",
    SERIE_TEMPORAL_CONCENTRADA: "serie_temporal_concentrada",
    SERIE_TEMPORAL_IRREGULAR: "serie_temporal_irregular",
    LIMIAR_INDISPONIVEL: "sem_historico_de_alertas_do_tipo",
    DATA_PASSADA: "evento_ja_ocorrido",
    FORA_JANELA: "previsao_fora_da_janela",
    SEM_PREVISAO: "sem_alerta_previsivel",
    PREVISAO_LINEAR_VALIDA: "previsao_linear_valida",
    LIMIAR_MANUTENCAO_JA_CRUZADO: "limiar_manutencao_ja_cruzado",
    LIMIAR_FALHA_JA_CRUZADO: "limiar_falha_ja_cruzado",
    RISCO_HEURISTICO_CRITICO: "risco_heuristico_critico"
  };

  static arredondar(valor, casas = 2) {
    return Number(Number(valor).toFixed(casas));
  }

  static getEnvNumber(name, fallback, { min = null, integer = false } = {}) {
    const raw = process.env[name];
    const parsed = Number(raw);

    if (!Number.isFinite(parsed)) return fallback;

    const normalized = integer ? Math.trunc(parsed) : parsed;

    if (min !== null && normalized < min) {
      return fallback;
    }

    return normalized;
  }

  static obterConfig() {
    return {
      minAmostrasLimiar: this.getEnvNumber(
        "PREDICAO_ALERTA_MIN_AMOSTRAS_LIMIAR",
        this.MIN_AMOSTRAS_LIMIAR,
        { min: 1, integer: true }
      ),
      limiaresOperacionais: {
        INSTABILIDADE: this.getEnvNumber(
          "PREDICAO_ALERTA_LIMIAR_INSTABILIDADE",
          this.LIMIARES_OPERACIONAIS.INSTABILIDADE,
          { min: 0 }
        ),
        TENDENCIA_CURTA: this.getEnvNumber(
          "PREDICAO_ALERTA_LIMIAR_TENDENCIA_CURTA",
          this.LIMIARES_OPERACIONAIS.TENDENCIA_CURTA,
          { min: 0 }
        ),
        TENDENCIA_LONGA: this.getEnvNumber(
          "PREDICAO_ALERTA_LIMIAR_TENDENCIA_LONGA",
          this.LIMIARES_OPERACIONAIS.TENDENCIA_LONGA,
          { min: 0 }
        )
      }
    };
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
    return PredicaoService.resumirModeloIntegridade(modeloResultado);
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
    if (amostras.length < this.obterConfig().minAmostrasLimiar) {
      return null;
    }

    return {
      integridadeLimiar: this.calcularMediana(amostras),
      amostrasLimiar: amostras.length
    };
  }

  static obterLimiarOperacional(tipo) {
    const integridadeLimiar = this.obterConfig().limiaresOperacionais[tipo];

    if (!Number.isFinite(integridadeLimiar)) {
      return null;
    }

    return {
      integridadeLimiar,
      amostrasLimiar: 0,
      fonteLimiar: "OPERACIONAL"
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

    return this.obterLimiarOperacional(tipo);
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

  static criarAusenciaPrevisao(motivo, detalhes = {}) {
    return {
      motivo,
      ...detalhes
    };
  }

  static montarRespostaBase({ maquinaId, estadoPredicao, fonteDecisao, urgencia, motivo, modeloIntegridade }) {
    return {
      maquinaId,
      estadoPredicao,
      fonteDecisao,
      urgencia,
      motivo,
      modeloIntegridade
    };
  }

  static async preverTipo(maquina, tipo, modeloResultado) {
    if (!modeloResultado?.valido || !modeloResultado?.modeloIntegridade) {
      return {
        predicao: null,
        ausencia: this.criarAusenciaPrevisao(
          modeloResultado?.motivo || this.MOTIVOS.MODELO_INVALIDO
        )
      };
    }

    const limiarHistorico = await this.obterLimiarHistorico(maquina, tipo);
    if (!limiarHistorico) {
      return {
        predicao: null,
        ausencia: this.criarAusenciaPrevisao(this.MOTIVOS.LIMIAR_INDISPONIVEL, { tipo })
      };
    }

    const modeloIntegridade = modeloResultado.modeloIntegridade;
    const horasAteLimiar = modeloIntegridade.modelo.computeX(limiarHistorico.integridadeLimiar);

    if (!Number.isFinite(horasAteLimiar) || horasAteLimiar <= 0) {
      return {
        predicao: null,
        ausencia: this.criarAusenciaPrevisao(this.MOTIVOS.DATA_PASSADA, { tipo })
      };
    }

    if (horasAteLimiar > (PredicaoService.LIMITE_MAXIMO_DIAS_PREVISAO * 24)) {
      return {
        predicao: null,
        ausencia: this.criarAusenciaPrevisao(this.MOTIVOS.FORA_JANELA, { tipo })
      };
    }

    const dataPrevista = PredicaoService.projetarDataLimiar(
      modeloIntegridade,
      limiarHistorico.integridadeLimiar,
      modeloIntegridade.dataBase
    );

    if (!dataPrevista || dataPrevista <= modeloIntegridade.referenciaTemporal) {
      return {
        predicao: null,
        ausencia: this.criarAusenciaPrevisao(this.MOTIVOS.DATA_PASSADA, { tipo })
      };
    }

    return {
      predicao: this.montarPredicaoTipo(tipo, dataPrevista, limiarHistorico, modeloIntegridade),
      ausencia: null
    };
  }

  static async preverPorMaquina(maquinaId) {
    const diagnostico = await PredicaoService.diagnosticarPredicao(maquinaId);
    if (!diagnostico?.maquina) {
      throw new AppError("Maquina nao encontrada.", 404);
    }

    const { maquina, avaliacaoModelo, estadoPredicao, fonteDecisao, urgencia, motivo } = diagnostico;
    const modeloIntegridade = this.resumirModeloIntegridade(avaliacaoModelo);

    if (estadoPredicao !== PredicaoService.ESTADOS.PREVISAO_VALIDA) {
      return {
        ...this.montarRespostaBase({
          maquinaId: maquina.id,
          estadoPredicao,
          fonteDecisao,
          urgencia,
          motivo,
          modeloIntegridade
        }),
        proximoAlerta: null,
        ausenciaProximoAlerta: this.criarAusenciaPrevisao(motivo),
        instabilidade: null,
        ausenciaInstabilidade: this.criarAusenciaPrevisao(motivo)
      };
    }

    const resultadosPorTipo = await Promise.all(
      this.TIPOS_SUPORTADOS.map((tipo) => this.preverTipo(maquina, tipo, avaliacaoModelo))
    );

    const previsoesValidas = resultadosPorTipo
      .map((resultado) => resultado.predicao)
      .filter(Boolean);

    const proximoAlerta = previsoesValidas.length
      ? [...previsoesValidas].sort((a, b) => a.dataPrevista - b.dataPrevista)[0]
      : null;

    const resultadoInstabilidade = resultadosPorTipo[
      this.TIPOS_SUPORTADOS.indexOf("INSTABILIDADE")
    ] || { predicao: null, ausencia: null };

    const instabilidade = this.montarPredicaoInstabilidade(
      resultadoInstabilidade.predicao
    );

    const ausenciaProximoAlerta = proximoAlerta
      ? null
      : this.criarAusenciaPrevisao(this.MOTIVOS.SEM_PREVISAO);

    const ausenciaInstabilidade = instabilidade
      ? null
      : (resultadoInstabilidade.ausencia || this.criarAusenciaPrevisao(this.MOTIVOS.SEM_PREVISAO));

    return {
      ...this.montarRespostaBase({
        maquinaId: maquina.id,
        estadoPredicao,
        fonteDecisao,
        urgencia,
        motivo,
        modeloIntegridade
      }),
      proximoAlerta,
      ausenciaProximoAlerta,
      instabilidade,
      ausenciaInstabilidade
    };
  }
}

module.exports = AlertaPreditivoService;
