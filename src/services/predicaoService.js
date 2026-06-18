const { SimpleLinearRegression } = require("ml-regression-simple-linear");
const AppError = require("../utils/appErrorUtils");
const PredicaoRiscoService = require("./predicaoRiscoService");
const PredicaoServiceAntigo = require("./predicaoServiceAntigo");

class PredicaoService {
  static MIN_PONTOS_REGRESSAO = 3;
  static LIMITE_PONTOS_REGRESSAO = 336;
  static LOOKBACK_DIAS_REGRESSAO = 7;
  static R2_MINIMO = 0.6;
  static LIMIAR_MANUTENCAO = 70;
  static LIMIAR_FALHA = 30;
  static LIMITE_MAXIMO_DIAS_PREVISAO = 90;
  static DIAS_ANTECEDENCIA_FIM_JANELA = 2;
  static MIN_JANELA_REGRESSAO_HORAS = 0.05;
  static MIN_INTERVALO_REGRESSAO_HORAS = 0.005;
  static MAX_RAZAO_INTERVALO_REGRESSAO = 60;
  static MAX_PONTOS_DESCARTE_REGRESSAO = 1;
  static LIMIAR_SENSOR_CRITICO = 40;
  static PENALIDADE_SENSOR_CRITICO_MAX = 20;

  static ESTADOS = {
    PREVISAO_VALIDA: "PREVISAO_VALIDA",
    MANUTENCAO_IMEDIATA: "MANUTENCAO_IMEDIATA",
    FALHA_JA_CRUZADA: "FALHA_JA_CRUZADA",
    MODELO_INVALIDO_COM_RISCO: "MODELO_INVALIDO_COM_RISCO",
    SEM_DADOS: "SEM_DADOS"
  };

  static FONTES = {
    REGRESSAO_LINEAR: "REGRESSAO_LINEAR",
    HEURISTICA_ANTIGA: "HEURISTICA_ANTIGA",
    HEURISTICA_CRITICA: "HEURISTICA_CRITICA",
    SEM_MODELO: "SEM_MODELO"
  };

  static URGENCIAS = {
    BAIXA: "BAIXA",
    MEDIA: "MEDIA",
    ALTA: "ALTA",
    IMEDIATA: "IMEDIATA"
  };

  static MOTIVOS = {
    PREVISAO_LINEAR_VALIDA: "previsao_linear_valida",
    PREVISAO_FALLBACK_ANTIGO: "previsao_fallback_antigo",
    LIMIAR_MANUTENCAO_JA_CRUZADO: "limiar_manutencao_ja_cruzado",
    LIMIAR_FALHA_JA_CRUZADO: "limiar_falha_ja_cruzado",
    RISCO_HEURISTICO_CRITICO: "risco_heuristico_critico",
    HISTORICO_INSUFICIENTE: "historico_insuficiente",
    MODELO_NAO_PODE_SER_CALCULADO: "modelo_nao_pode_ser_calculado",
    TENDENCIA_NAO_CONFIAVEL: "tendencia_nao_confiavel",
    JANELA_TEMPORAL_INSUFICIENTE: "janela_temporal_insuficiente",
    SERIE_TEMPORAL_CONCENTRADA: "serie_temporal_concentrada",
    SERIE_TEMPORAL_IRREGULAR: "serie_temporal_irregular",
    PREVISAO_PASSADA: "previsao_passada"
  };

  static round(value, digits = 2) {
    if (!Number.isFinite(Number(value))) return null;
    return Number(Number(value).toFixed(digits));
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

  static obterConfigPredicao() {
    return {
      minPontosRegressao: this.getEnvNumber(
        "PREDICAO_MIN_PONTOS_REGRESSAO",
        this.MIN_PONTOS_REGRESSAO,
        { min: 2, integer: true }
      ),
      minJanelaRegressaoHoras: this.getEnvNumber(
        "PREDICAO_MIN_JANELA_REGRESSAO_HORAS",
        this.MIN_JANELA_REGRESSAO_HORAS,
        { min: 0 }
      ),
      minIntervaloRegressaoHoras: this.getEnvNumber(
        "PREDICAO_MIN_INTERVALO_REGRESSAO_HORAS",
        this.MIN_INTERVALO_REGRESSAO_HORAS,
        { min: 0 }
      ),
      maxRazaoIntervaloRegressao: this.getEnvNumber(
        "PREDICAO_MAX_RAZAO_INTERVALO_REGRESSAO",
        this.MAX_RAZAO_INTERVALO_REGRESSAO,
        { min: 1 }
      ),
      maxPontosDescarteRegressao: this.getEnvNumber(
        "PREDICAO_MAX_PONTOS_DESCARTE_REGRESSAO",
        this.MAX_PONTOS_DESCARTE_REGRESSAO,
        { min: 0, integer: true }
      ),
      limitePontosRegressao: this.getEnvNumber(
        "PREDICAO_LIMITE_PONTOS_REGRESSAO",
        this.LIMITE_PONTOS_REGRESSAO,
        { min: 2, integer: true }
      ),
      lookbackDiasRegressao: this.getEnvNumber(
        "PREDICAO_LOOKBACK_DIAS_REGRESSAO",
        this.LOOKBACK_DIAS_REGRESSAO,
        { min: 1, integer: true }
      )
    };
  }

  static parseIdsEnv(value) {
    return String(value || "")
      .split(",")
      .map((id) => Number(id.trim()))
      .filter((id) => Number.isInteger(id) && id > 0);
  }

  static obterMultiplicadorIntegridade(maquinaId) {
    const maquinasDemo = this.parseIdsEnv(process.env.INTEGRIDADE_DEMO_MAQUINAS_IDS);
    if (!maquinasDemo.includes(Number(maquinaId))) {
      return 1;
    }

    return this.getEnvNumber("INTEGRIDADE_DEMO_MULTIPLICADOR_DESVIO", 1, { min: 0 });
  }

  static calcularHealthScore(sensor, { multiplicadorDesvio = 1 } = {}) {
    const temp = sensor.temperatura || sensor.ultimaTemperatura || 0;
    const vibra = sensor.vibracao || sensor.ultimaVibracao || 0;

    const diffTemp = (sensor.limiteTemperatura - sensor.idealTemperatura) || 1;
    const diffVibra = (sensor.limiteVibracao - sensor.idealVibracao) || 1;

    let scoreTemp = 1 - (((temp - sensor.idealTemperatura) / diffTemp) * multiplicadorDesvio);
    let scoreVibra = 1 - (((vibra - sensor.idealVibracao) / diffVibra) * multiplicadorDesvio);

    scoreTemp = Math.max(0, Math.min(1, scoreTemp));
    scoreVibra = Math.max(0, Math.min(1, scoreVibra));

    const total = ((scoreTemp * 0.4) + (scoreVibra * 0.6)) * 100;
    return parseFloat(total.toFixed(2)) || 0;
  }

  static calcularIntegridadeAgregada(scores) {
    if (!Array.isArray(scores) || scores.length === 0) {
      return 100;
    }

    const mediaBase = scores.reduce((total, value) => total + value, 0) / scores.length;
    const piorScore = Math.min(...scores);
    const penalidade = piorScore < this.LIMIAR_MANUTENCAO
      ? Math.min(
          this.PENALIDADE_SENSOR_CRITICO_MAX,
          (this.LIMIAR_MANUTENCAO - piorScore) * 0.5
        )
      : 0;

    return this.round(Math.max(0, Math.min(100, mediaBase - penalidade)));
  }

  static async atualizarSaudeMaquina(maquinaId, options = {}) {
    try {
      const MaquinaModel = require("../models/maquinaModel");
      const maquina = await MaquinaModel.findById(maquinaId, { include: { sensores: true } });

      if (!maquina || !maquina.sensores || maquina.sensores.length === 0) {
        return options.detalhado
          ? { integridade: 100, maquina: maquina || null, historicoIntegridade: null }
          : 100;
      }

      const multiplicadorDesvio = this.obterMultiplicadorIntegridade(maquinaId);
      const scores = maquina.sensores.map((sensor) => this.calcularHealthScore(sensor, { multiplicadorDesvio }));
      const integridadeAgregada = this.calcularIntegridadeAgregada(scores);

      console.log(`--- ATUALIZANDO MAQUINA ${maquinaId} | SCORE: ${integridadeAgregada} ---`);

      const resultadoAtualizacao = await MaquinaModel.update(
        maquinaId,
        { integridade: integridadeAgregada },
        { includeHistoricoIntegridade: options.detalhado }
      );

      if (options.detalhado) {
        return {
          integridade: integridadeAgregada,
          maquina: resultadoAtualizacao?.maquina || resultadoAtualizacao,
          historicoIntegridade: resultadoAtualizacao?.historicoIntegridade || null
        };
      }

      return integridadeAgregada;
    } catch (error) {
      throw new AppError("Erro ao atualizar saude da maquina.", 500);
    }
  }

  static criarPontosRegressao(historico) {
    if (!Array.isArray(historico) || historico.length === 0) return [];

    const pontosOrdenados = historico
      .map((registro) => ({
        y: Number(registro.integridade),
        criadoEm: new Date(registro.criadoEm)
      }))
      .filter((registro) => Number.isFinite(registro.y) && !Number.isNaN(registro.criadoEm.getTime()))
      .sort((a, b) => a.criadoEm - b.criadoEm);

    if (!pontosOrdenados.length) return [];

    const dataBase = pontosOrdenados[0].criadoEm;

    return pontosOrdenados.map((registro) => ({
      x: (registro.criadoEm.getTime() - dataBase.getTime()) / (1000 * 60 * 60),
      y: registro.y,
      criadoEm: registro.criadoEm
    }));
  }

  static criarModeloRegressao(pontos) {
    if (pontos.length < 2) return null;

    const x = pontos.map((ponto) => ponto.x);
    const y = pontos.map((ponto) => ponto.y);
    const modelo = new SimpleLinearRegression(x, y);
    const score = modelo.score(x, y);

    return {
      modelo,
      score,
      slope: modelo.slope,
      intercept: modelo.intercept
    };
  }

  static modeloPassaCriterios({ serieTemporal, regressao }) {
    return Boolean(
      serieTemporal?.valida
      && regressao
      && regressao.slope < 0
      && regressao.score.r2 >= this.R2_MINIMO
    );
  }

  static avaliarCandidatoRegressao(pontos, config = this.obterConfigPredicao()) {
    const serieTemporal = this.analisarSerieTemporal(pontos, config);
    const regressao = this.criarModeloRegressao(pontos);

    return {
      pontos,
      serieTemporal,
      regressao,
      valido: this.modeloPassaCriterios({ serieTemporal, regressao })
    };
  }

  static removerPontoEm(pontos, index) {
    return pontos.filter((_, pointIndex) => pointIndex !== index);
  }

  static compararCandidatosRegressao(left, right) {
    if (!left) return right;
    if (!right) return left;

    const leftR2 = Number(left.regressao?.score?.r2);
    const rightR2 = Number(right.regressao?.score?.r2);

    if (!Number.isFinite(leftR2)) return right;
    if (!Number.isFinite(rightR2)) return left;

    if (rightR2 > leftR2) return right;
    if (rightR2 === leftR2 && right.pontos.length > left.pontos.length) return right;

    return left;
  }

  static selecionarCandidatoRegressao(pontos, config = this.obterConfigPredicao()) {
    const candidatoCompleto = this.avaliarCandidatoRegressao(pontos, config);

    if (candidatoCompleto.valido) {
      return candidatoCompleto;
    }

    const maxDescartes = Math.min(
      config.maxPontosDescarteRegressao,
      Math.max(0, pontos.length - config.minPontosRegressao)
    );
    let bases = [pontos];

    for (let descartes = 1; descartes <= maxDescartes; descartes += 1) {
      const proximasBases = [];
      let melhorValido = null;

      for (const base of bases) {
        for (let index = 0; index < base.length; index += 1) {
          const pontosCandidato = this.removerPontoEm(base, index);

          if (pontosCandidato.length < config.minPontosRegressao) {
            continue;
          }

          proximasBases.push(pontosCandidato);
          const candidato = this.avaliarCandidatoRegressao(pontosCandidato, config);

          if (candidato.valido) {
            melhorValido = this.compararCandidatosRegressao(melhorValido, candidato);
          }
        }
      }

      if (melhorValido) {
        return melhorValido;
      }

      bases = proximasBases;
    }

    return candidatoCompleto;
  }

  static analisarSerieTemporal(pontos, config = this.obterConfigPredicao()) {
    if (!Array.isArray(pontos) || pontos.length < 2) {
      return {
        valida: false,
        motivo: this.MOTIVOS.MODELO_NAO_PODE_SER_CALCULADO,
        janelaHorasCoberta: 0,
        ultimoPontoEm: null,
        intervaloMedioHoras: null,
        irregularidadeIndice: null
      };
    }

    const primeiroPonto = pontos[0].criadoEm;
    const ultimoPonto = pontos[pontos.length - 1].criadoEm;
    const janelaHorasCoberta = (ultimoPonto.getTime() - primeiroPonto.getTime()) / (1000 * 60 * 60);

    const intervalos = [];

    for (let index = 1; index < pontos.length; index += 1) {
      const intervalo = (pontos[index].criadoEm.getTime() - pontos[index - 1].criadoEm.getTime()) / (1000 * 60 * 60);

      if (!Number.isFinite(intervalo) || intervalo <= 0) {
        return {
          valida: false,
          motivo: this.MOTIVOS.SERIE_TEMPORAL_CONCENTRADA,
          janelaHorasCoberta,
          ultimoPontoEm: ultimoPonto,
          intervaloMedioHoras: null,
          irregularidadeIndice: null
        };
      }

      intervalos.push(intervalo);
    }

    const menorIntervaloHoras = Math.min(...intervalos);
    const maiorIntervaloHoras = Math.max(...intervalos);
    const intervaloMedioHoras = intervalos.reduce((total, value) => total + value, 0) / intervalos.length;
    const irregularidadeIndice = menorIntervaloHoras > 0
      ? maiorIntervaloHoras / menorIntervaloHoras
      : null;

    if (janelaHorasCoberta < config.minJanelaRegressaoHoras) {
      return {
        valida: false,
        motivo: this.MOTIVOS.JANELA_TEMPORAL_INSUFICIENTE,
        janelaHorasCoberta,
        ultimoPontoEm: ultimoPonto,
        intervaloMedioHoras,
        irregularidadeIndice
      };
    }

    if (menorIntervaloHoras < config.minIntervaloRegressaoHoras) {
      return {
        valida: false,
        motivo: this.MOTIVOS.SERIE_TEMPORAL_CONCENTRADA,
        janelaHorasCoberta,
        ultimoPontoEm: ultimoPonto,
        intervaloMedioHoras,
        irregularidadeIndice
      };
    }

    if (Number.isFinite(irregularidadeIndice) && irregularidadeIndice > config.maxRazaoIntervaloRegressao) {
      return {
        valida: false,
        motivo: this.MOTIVOS.SERIE_TEMPORAL_IRREGULAR,
        janelaHorasCoberta,
        ultimoPontoEm: ultimoPonto,
        intervaloMedioHoras,
        irregularidadeIndice
      };
    }

    return {
      valida: true,
      motivo: null,
      janelaHorasCoberta,
      ultimoPontoEm: ultimoPonto,
      intervaloMedioHoras,
      irregularidadeIndice
    };
  }

  static projetarDataLimiar(regressao, limiar, dataBase) {
    if (!regressao || regressao.slope >= 0) return null;

    const horasAteLimiar = regressao.modelo.computeX(limiar);

    if (!Number.isFinite(horasAteLimiar) || horasAteLimiar <= 0) {
      return null;
    }

    if (horasAteLimiar > (this.LIMITE_MAXIMO_DIAS_PREVISAO * 24)) {
      return null;
    }

    return new Date(dataBase.getTime() + (horasAteLimiar * 60 * 60 * 1000));
  }

  static async limparPrevisao(maquinaId, MaquinaModel) {
    return await MaquinaModel.update(maquinaId, {
      previsaoManutencao: null,
      janelaManuInicio: null,
      janelaManuFim: null
    });
  }

  static montarPersistenciaPredicao(diagnostico) {
    if (!diagnostico) return null;

    if (diagnostico.estadoPredicao === this.ESTADOS.PREVISAO_VALIDA) {
      const previsaoManutencao = diagnostico.dataInicioManutencao || diagnostico.dataFalha;

      if (!previsaoManutencao) return null;

      return {
        previsaoManutencao,
        janelaManuInicio: diagnostico.janelaManuInicio,
        janelaManuFim: diagnostico.janelaManuFim
      };
    }

    if (![this.ESTADOS.MANUTENCAO_IMEDIATA, this.ESTADOS.FALHA_JA_CRUZADA].includes(diagnostico.estadoPredicao)) {
      return null;
    }

    const referenciaTemporal = diagnostico.avaliacaoModelo?.modeloIntegridade?.referenciaTemporal || new Date();
    const inicioCandidato = [
      diagnostico.janelaManuInicio,
      diagnostico.dataInicioManutencao,
      diagnostico.dataFalha
    ].find((data) => data && data >= referenciaTemporal);
    const janelaManuInicio = inicioCandidato || referenciaTemporal;
    const fimCandidato = diagnostico.janelaManuFim && diagnostico.janelaManuFim >= janelaManuInicio
      ? diagnostico.janelaManuFim
      : null;
    const janelaManuFim = fimCandidato || janelaManuInicio;

    return {
      previsaoManutencao: janelaManuInicio,
      janelaManuInicio,
      janelaManuFim
    };
  }

  static obterReferenciaTemporal(pontos) {
    const ultimoPonto = pontos[pontos.length - 1]?.criadoEm;
    const agora = new Date();

    if (!ultimoPonto) {
      return agora;
    }

    return ultimoPonto > agora ? ultimoPonto : agora;
  }

  static resumirModeloIntegridade(avaliacaoModelo) {
    if (!avaliacaoModelo?.modeloIntegridade) {
      return null;
    }

    const {
      score,
      slope,
      intercept,
      pontosUsados,
      janelaHorasCoberta,
      ultimoPontoEm
    } = avaliacaoModelo.modeloIntegridade;

    return {
      r2: this.round(score.r2, 2),
      slope: this.round(slope, 4),
      intercept: this.round(intercept, 2),
      pontosUsados,
      janelaHorasCoberta: this.round(janelaHorasCoberta, 2),
      ultimoPontoEm
    };
  }

  static async avaliarModeloIntegridade(maquinaId) {
    const HistoricoIntegridadeModel = require("../models/historicoIntegridadeModel");
    const config = this.obterConfigPredicao();
    const dataInicio = new Date(Date.now() - (config.lookbackDiasRegressao * 24 * 60 * 60 * 1000));

    const historico = await HistoricoIntegridadeModel.findSerieByMaquina(maquinaId, {
      limite: config.limitePontosRegressao,
      dataInicio,
      aposUltimaManutencao: true
    });

    if (historico.length < config.minPontosRegressao) {
      return {
        disponivel: false,
        valido: false,
        motivo: this.MOTIVOS.HISTORICO_INSUFICIENTE,
        modeloIntegridade: null
      };
    }

    const pontos = this.criarPontosRegressao(historico);
    const candidato = this.selecionarCandidatoRegressao(pontos, config);
    const { serieTemporal, regressao } = candidato;

    if (!regressao) {
      return {
        disponivel: false,
        valido: false,
        motivo: this.MOTIVOS.MODELO_NAO_PODE_SER_CALCULADO,
        modeloIntegridade: null
      };
    }

    const modeloIntegridade = {
      modelo: regressao.modelo,
      score: regressao.score,
      slope: regressao.slope,
      intercept: regressao.intercept,
      dataBase: candidato.pontos[0].criadoEm,
      referenciaTemporal: this.obterReferenciaTemporal(candidato.pontos),
      pontosUsados: candidato.pontos.length,
      janelaHorasCoberta: serieTemporal.janelaHorasCoberta,
      ultimoPontoEm: serieTemporal.ultimoPontoEm,
      intervaloMedioHoras: serieTemporal.intervaloMedioHoras,
      irregularidadeIndice: serieTemporal.irregularidadeIndice
    };

    if (!serieTemporal.valida) {
      return {
        disponivel: true,
        valido: false,
        motivo: serieTemporal.motivo,
        modeloIntegridade
      };
    }

    const valido = modeloIntegridade.slope < 0 && modeloIntegridade.score.r2 >= this.R2_MINIMO;

    return {
      disponivel: true,
      valido,
      motivo: valido ? null : this.MOTIVOS.TENDENCIA_NAO_CONFIAVEL,
      modeloIntegridade
    };
  }

  static async obterModeloIntegridade(maquinaId) {
    return await this.avaliarModeloIntegridade(maquinaId);
  }

  static calcularUrgenciaPorData(dataFalha, referenciaTemporal) {
    if (!dataFalha || !referenciaTemporal) {
      return this.URGENCIAS.MEDIA;
    }

    const horasAteFalha = (dataFalha.getTime() - referenciaTemporal.getTime()) / (1000 * 60 * 60);

    if (horasAteFalha <= 24) return this.URGENCIAS.IMEDIATA;
    if (horasAteFalha <= 72) return this.URGENCIAS.ALTA;
    if (horasAteFalha <= (7 * 24)) return this.URGENCIAS.MEDIA;
    return this.URGENCIAS.BAIXA;
  }

  static buildEstadoPreditivo(codigo, fonteDecisao, urgencia, motivo) {
    return {
      estadoPredicao: codigo,
      fonteDecisao,
      urgencia,
      motivo
    };
  }

  static async obterRiscoFallback(maquinaId) {
    try {
      return await PredicaoRiscoService.preverPorMaquina(maquinaId);
    } catch (error) {
      return null;
    }
  }

  static async obterFallbackAntigo(maquinaId, { maquina, referenciaTemporal }) {
    try {
      return await PredicaoServiceAntigo.diagnosticarFallback(maquinaId, {
        maquina,
        referenciaTemporal
      });
    } catch (error) {
      return null;
    }
  }

  static deveAcionarFallbackCritico(maquina, riscoAtual) {
    const riscoManutencao = riscoAtual?.riscos?.manutencao;
    const prob24h = Number(riscoManutencao?.["24h"]);
    const prob72h = Number(riscoManutencao?.["72h"]);
    const classificacao = riscoManutencao?.classificacao;
    const integridadeAtual = Number(maquina?.integridade);
    const scoreEstabilidadeAtual = Number(maquina?.scoreEstabilidade);

    if (classificacao === "ALTO") return true;
    if (Number.isFinite(prob24h) && prob24h >= 0.7) return true;
    if (Number.isFinite(prob72h) && prob72h >= 0.7) return true;
    if (Number.isFinite(integridadeAtual) && integridadeAtual <= 75
      && Number.isFinite(scoreEstabilidadeAtual) && scoreEstabilidadeAtual <= 60) {
      return true;
    }

    return false;
  }

  static resolverEstadoPreditivo({
    maquina,
    avaliacaoModelo,
    riscoAtual,
    dataInicioManutencao,
    dataFalha,
    previsaoValida
  }) {
    const integridadeAtual = Number(maquina?.integridade);

    if (Number.isFinite(integridadeAtual) && integridadeAtual <= this.LIMIAR_FALHA) {
      return this.buildEstadoPreditivo(
        this.ESTADOS.FALHA_JA_CRUZADA,
        this.FONTES.HEURISTICA_CRITICA,
        this.URGENCIAS.IMEDIATA,
        this.MOTIVOS.LIMIAR_FALHA_JA_CRUZADO
      );
    }

    if (Number.isFinite(integridadeAtual) && integridadeAtual <= this.LIMIAR_MANUTENCAO) {
      return this.buildEstadoPreditivo(
        this.ESTADOS.MANUTENCAO_IMEDIATA,
        this.FONTES.HEURISTICA_CRITICA,
        this.URGENCIAS.IMEDIATA,
        this.MOTIVOS.LIMIAR_MANUTENCAO_JA_CRUZADO
      );
    }

    const referenciaTemporal = avaliacaoModelo?.modeloIntegridade?.referenciaTemporal;

    if (referenciaTemporal && dataFalha && dataFalha <= referenciaTemporal) {
      return this.buildEstadoPreditivo(
        this.ESTADOS.FALHA_JA_CRUZADA,
        this.FONTES.HEURISTICA_CRITICA,
        this.URGENCIAS.IMEDIATA,
        this.MOTIVOS.LIMIAR_FALHA_JA_CRUZADO
      );
    }

    if (referenciaTemporal && dataInicioManutencao && dataInicioManutencao <= referenciaTemporal) {
      return this.buildEstadoPreditivo(
        this.ESTADOS.MANUTENCAO_IMEDIATA,
        this.FONTES.HEURISTICA_CRITICA,
        this.URGENCIAS.IMEDIATA,
        this.MOTIVOS.LIMIAR_MANUTENCAO_JA_CRUZADO
      );
    }

    if (previsaoValida && referenciaTemporal) {
      return this.buildEstadoPreditivo(
        this.ESTADOS.PREVISAO_VALIDA,
        this.FONTES.REGRESSAO_LINEAR,
        this.calcularUrgenciaPorData(dataInicioManutencao || dataFalha, avaliacaoModelo.modeloIntegridade.referenciaTemporal),
        this.MOTIVOS.PREVISAO_LINEAR_VALIDA
      );
    }

    if (this.deveAcionarFallbackCritico(maquina, riscoAtual)) {
      const urgencia = Number(riscoAtual?.riscos?.manutencao?.["24h"]) >= 0.8
        ? this.URGENCIAS.IMEDIATA
        : this.URGENCIAS.ALTA;

      return this.buildEstadoPreditivo(
        this.ESTADOS.MODELO_INVALIDO_COM_RISCO,
        this.FONTES.HEURISTICA_CRITICA,
        urgencia,
        this.MOTIVOS.RISCO_HEURISTICO_CRITICO
      );
    }

    return this.buildEstadoPreditivo(
      this.ESTADOS.SEM_DADOS,
      this.FONTES.SEM_MODELO,
      this.URGENCIAS.MEDIA,
      avaliacaoModelo?.motivo || this.MOTIVOS.PREVISAO_PASSADA
    );
  }

  static calcularJanelaManutencao(dataInicioManutencao, dataFalha, referenciaTemporal) {
    let janelaManuInicio = dataInicioManutencao;

    if (!janelaManuInicio || janelaManuInicio < referenciaTemporal) {
      janelaManuInicio = new Date(referenciaTemporal.getTime());
    }

    let janelaManuFim = new Date(dataFalha.getTime());
    janelaManuFim.setDate(janelaManuFim.getDate() - this.DIAS_ANTECEDENCIA_FIM_JANELA);

    if (janelaManuFim < referenciaTemporal) {
      janelaManuFim = new Date(referenciaTemporal.getTime());
    }

    if (janelaManuInicio > janelaManuFim) {
      janelaManuFim = new Date(janelaManuInicio.getTime());
    }

    return {
      janelaManuInicio,
      janelaManuFim
    };
  }

  static async diagnosticarPredicao(maquinaId, maquinaExistente = null) {
    const MaquinaModel = require("../models/maquinaModel");
    const maquina = maquinaExistente || await MaquinaModel.findById(maquinaId);

    if (!maquina) {
      return null;
    }

    let avaliacaoModelo = await this.avaliarModeloIntegridade(maquinaId);
    let dataInicioManutencao = null;
    let dataFalha = null;
    let janelaManuInicio = null;
    let janelaManuFim = null;
    let fallbackAntigoAplicado = false;

    if (avaliacaoModelo?.valido && avaliacaoModelo.modeloIntegridade) {
      dataInicioManutencao = this.projetarDataLimiar(
        avaliacaoModelo.modeloIntegridade,
        this.LIMIAR_MANUTENCAO,
        avaliacaoModelo.modeloIntegridade.dataBase
      );

      dataFalha = this.projetarDataLimiar(
        avaliacaoModelo.modeloIntegridade,
        this.LIMIAR_FALHA,
        avaliacaoModelo.modeloIntegridade.dataBase
      );

      if (dataFalha && dataFalha > avaliacaoModelo.modeloIntegridade.referenciaTemporal) {
        const janela = this.calcularJanelaManutencao(
          dataInicioManutencao,
          dataFalha,
          avaliacaoModelo.modeloIntegridade.referenciaTemporal
        );

        janelaManuInicio = janela.janelaManuInicio;
        janelaManuFim = janela.janelaManuFim;
      } else if (dataInicioManutencao && dataInicioManutencao > avaliacaoModelo.modeloIntegridade.referenciaTemporal) {
        janelaManuInicio = dataInicioManutencao;
        janelaManuFim = dataInicioManutencao;
      }
    }

    let previsaoValida = Boolean(
      avaliacaoModelo?.modeloIntegridade?.referenciaTemporal
      && (
        (dataInicioManutencao && dataInicioManutencao > avaliacaoModelo.modeloIntegridade.referenciaTemporal)
        || (dataFalha && dataFalha > avaliacaoModelo.modeloIntegridade.referenciaTemporal)
      )
    );

    if (!previsaoValida) {
      const referenciaFallback = avaliacaoModelo?.modeloIntegridade?.referenciaTemporal || new Date();
      const fallbackAntigo = await this.obterFallbackAntigo(maquinaId, {
        maquina,
        referenciaTemporal: referenciaFallback
      });

      if (fallbackAntigo) {
        fallbackAntigoAplicado = true;
        avaliacaoModelo = fallbackAntigo.avaliacaoModelo;
        dataInicioManutencao = fallbackAntigo.dataInicioManutencao;
        dataFalha = fallbackAntigo.dataFalha;
        janelaManuInicio = fallbackAntigo.janelaManuInicio;
        janelaManuFim = fallbackAntigo.janelaManuFim;
        previsaoValida = true;
      }
    }

    const precisaRiscoFallback = !previsaoValida;
    const riscoAtual = precisaRiscoFallback
      ? await this.obterRiscoFallback(maquinaId)
      : null;

    const estado = fallbackAntigoAplicado
      ? this.buildEstadoPreditivo(
          this.ESTADOS.PREVISAO_VALIDA,
          this.FONTES.HEURISTICA_ANTIGA,
          this.calcularUrgenciaPorData(
            dataInicioManutencao || dataFalha,
            avaliacaoModelo.modeloIntegridade.referenciaTemporal
          ),
          this.MOTIVOS.PREVISAO_FALLBACK_ANTIGO
        )
      : this.resolverEstadoPreditivo({
          maquina,
          avaliacaoModelo,
          riscoAtual,
          dataInicioManutencao,
          dataFalha,
          previsaoValida
        });

    return {
      maquina,
      avaliacaoModelo,
      riscoAtual,
      dataInicioManutencao,
      dataFalha,
      janelaManuInicio,
      janelaManuFim,
      ...estado
    };
  }

  static async previsaoManutencao(maquinaId) {
    try {
      const MaquinaModel = require("../models/maquinaModel");
      const diagnostico = await this.diagnosticarPredicao(maquinaId);

      if (!diagnostico?.maquina) return null;

      let persisted = null;

      const dadosPersistencia = this.montarPersistenciaPredicao(diagnostico);

      if (dadosPersistencia) {
        const modeloIntegridade = diagnostico.avaliacaoModelo?.modeloIntegridade;

        if (modeloIntegridade) {
          console.log(
            `[PREDICAO] Maquina ${maquinaId}: inclinacao=${modeloIntegridade.slope.toFixed(4)} ` +
            `intercepto=${modeloIntegridade.intercept.toFixed(4)} ` +
            `r2=${modeloIntegridade.score.r2.toFixed(4)} ` +
            `manutencao=${diagnostico.dataInicioManutencao?.toISOString() || null} ` +
            `falha=${diagnostico.dataFalha?.toISOString() || null}`
          );
        }

        persisted = await MaquinaModel.update(maquinaId, dadosPersistencia);
      } else {
        persisted = await this.limparPrevisao(maquinaId, MaquinaModel);
      }

      const ManutencaoService = require("./manutencaoService");
      const manutencaoPreditiva = await ManutencaoService.syncPreventivaPreditiva(diagnostico);

      return {
        maquinaId: diagnostico.maquina.id,
        estadoPredicao: diagnostico.estadoPredicao,
        fonteDecisao: diagnostico.fonteDecisao,
        urgencia: diagnostico.urgencia,
        motivo: diagnostico.motivo,
        previsaoManutencao: persisted?.previsaoManutencao || null,
        dataInicioManutencao: diagnostico.dataInicioManutencao,
        dataFalha: diagnostico.dataFalha,
        janelaManuInicio: persisted?.janelaManuInicio || null,
        janelaManuFim: persisted?.janelaManuFim || null,
        modeloIntegridade: this.resumirModeloIntegridade(diagnostico.avaliacaoModelo),
        manutencaoPreditiva
      };
    } catch (error) {
      throw new AppError("Erro ao calcular previsao de manutencao.", 500);
    }
  }
}

module.exports = PredicaoService;
