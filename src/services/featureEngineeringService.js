const { SimpleLinearRegression } = require("ml-regression-simple-linear");
const AlertaModel = require("../models/alertaModel");
const HistoricoIntegridadeModel = require("../models/historicoIntegridadeModel");
const LeituraModel = require("../models/leituraModel");
const MaquinaModel = require("../models/maquinaModel");
const AppError = require("../utils/appErrorUtils");

class FeatureEngineeringService {
  static MIN_PONTOS_HISTORICO = 3;
  static MIN_LEITURAS_24H = 2;
  static MIN_LEITURAS_72H = 3;
  static LIMIAR_LEITURA_RECENTE_HORAS = 6;
  static LOOKBACK_DIAS = 7;
  static TIPOS_ALERTA_SUPORTADOS = [
    "LIMITE_ULTRAPASSADO",
    "INSTABILIDADE",
    "TENDENCIA_CURTA",
    "TENDENCIA_LONGA"
  ];
  static STATUS_ALERTA_ATIVO = ["ATIVO", "EM_ANDAMENTO"];
  static MOTIVOS = {
    HISTORICO_INSUFICIENTE: "historico_insuficiente",
    LEITURAS_INSUFICIENTES: "leituras_insuficientes",
    SEM_LEITURA_RECENTE: "sem_leitura_recente",
    BASE_ALERTAS_INSUFICIENTE: "historico_de_alertas_insuficiente"
  };

  static round(value, digits = 4) {
    if (!Number.isFinite(Number(value))) {
      return null;
    }

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

  static obterConfig() {
    return {
      minPontosHistorico: this.getEnvNumber(
        "PREDICAO_RISCO_MIN_PONTOS_HISTORICO",
        this.MIN_PONTOS_HISTORICO,
        { min: 2, integer: true }
      ),
      minLeituras24h: this.getEnvNumber(
        "PREDICAO_RISCO_MIN_LEITURAS_24H",
        this.MIN_LEITURAS_24H,
        { min: 1, integer: true }
      ),
      minLeituras72h: this.getEnvNumber(
        "PREDICAO_RISCO_MIN_LEITURAS_72H",
        this.MIN_LEITURAS_72H,
        { min: 1, integer: true }
      ),
      limiarLeituraRecenteHoras: this.getEnvNumber(
        "PREDICAO_RISCO_LEITURA_RECENTE_HORAS",
        this.LIMIAR_LEITURA_RECENTE_HORAS,
        { min: 0 }
      )
    };
  }

  static mean(values) {
    if (!Array.isArray(values) || values.length === 0) return null;
    return values.reduce((total, value) => total + value, 0) / values.length;
  }

  static min(values) {
    if (!Array.isArray(values) || values.length === 0) return null;
    return Math.min(...values);
  }

  static max(values) {
    if (!Array.isArray(values) || values.length === 0) return null;
    return Math.max(...values);
  }

  static stddev(values) {
    if (!Array.isArray(values) || values.length < 2) return null;

    const average = this.mean(values);
    const variance = values.reduce((total, value) => total + ((value - average) ** 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  static ratio(numerator, denominator) {
    if (!Number.isFinite(Number(numerator)) || !Number.isFinite(Number(denominator)) || Number(denominator) === 0) {
      return null;
    }

    return Number(numerator) / Number(denominator);
  }

  static countWhere(items, predicate) {
    return items.reduce((count, item) => (predicate(item) ? count + 1 : count), 0);
  }

  static getWindow(items, startDate) {
    return items.filter((item) => new Date(item.criadoEm) >= startDate);
  }

  static calcularSlopePorSerie(serie, valueKey) {
    if (!Array.isArray(serie) || serie.length < 2) return null;

    const pontosValidos = serie
      .filter((item) => Number.isFinite(Number(item[valueKey])))
      .map((item) => ({
        x: new Date(item.criadoEm).getTime(),
        y: Number(item[valueKey])
      }));

    if (pontosValidos.length < 2) return null;

    const dataBase = pontosValidos[0].x;
    const x = pontosValidos.map((item) => (item.x - dataBase) / (1000 * 60 * 60));
    const y = pontosValidos.map((item) => item.y);
    const modelo = new SimpleLinearRegression(x, y);
    return modelo.slope;
  }

  static calcularVariacao(serie, valueKey) {
    if (!Array.isArray(serie) || serie.length < 2) return null;

    const validos = serie.filter((item) => Number.isFinite(Number(item[valueKey])));
    if (validos.length < 2) return null;

    return Number(validos[validos.length - 1][valueKey]) - Number(validos[0][valueKey]);
  }

  static obterUltimaLeitura(maquina, leituras) {
    const datasSensores = Array.isArray(maquina?.sensores)
      ? maquina.sensores.map((sensor) => sensor.ultimaLeituraEm).filter(Boolean).map((value) => new Date(value))
      : [];

    const datasLeituras = Array.isArray(leituras)
      ? leituras.map((leitura) => leitura.criadoEm).filter(Boolean).map((value) => new Date(value))
      : [];

    const todasDatas = [...datasSensores, ...datasLeituras];
    if (!todasDatas.length) return null;

    return new Date(Math.max(...todasDatas.map((date) => date.getTime())));
  }

  static calcularTempoDesdeUltimaLeituraHoras(dataUltimaLeitura, now) {
    if (!dataUltimaLeitura) return null;
    return (now.getTime() - dataUltimaLeitura.getTime()) / (1000 * 60 * 60);
  }

  static buildReadingsStats(leituras) {
    const temperaturas = leituras.map((leitura) => Number(leitura.temperatura));
    const vibracoes = leituras.map((leitura) => Number(leitura.vibracao));

    const acimaIdeal = this.countWhere(leituras, (leitura) => (
      Number(leitura.temperatura) > Number(leitura.sensor.idealTemperatura) ||
      Number(leitura.vibracao) > Number(leitura.sensor.idealVibracao)
    ));

    const acimaLimite = this.countWhere(leituras, (leitura) => (
      Number(leitura.temperatura) > Number(leitura.sensor.limiteTemperatura) ||
      Number(leitura.vibracao) > Number(leitura.sensor.limiteVibracao)
    ));

    const averageTemp = this.mean(temperaturas);
    const averageVibration = this.mean(vibracoes);
    const stdTemp = this.stddev(temperaturas);
    const stdVibration = this.stddev(vibracoes);

    return {
      count: leituras.length,
      temperaturaMedia: averageTemp,
      temperaturaMinima: this.min(temperaturas),
      temperaturaMaxima: this.max(temperaturas),
      vibracaoMedia: averageVibration,
      vibracaoMinima: this.min(vibracoes),
      vibracaoMaxima: this.max(vibracoes),
      desvioTemperatura: stdTemp,
      desvioVibracao: stdVibration,
      proporcaoAcimaIdeal: this.ratio(acimaIdeal, leituras.length),
      proporcaoAcimaLimite: this.ratio(acimaLimite, leituras.length),
      indiceVariabilidadeTemperatura: this.ratio(stdTemp, Math.max(Math.abs(averageTemp || 0), 1)),
      indiceVariabilidadeVibracao: this.ratio(stdVibration, Math.max(Math.abs(averageVibration || 0), 1))
    };
  }

  static countAlertsByType(alertas, tipo) {
    return alertas.filter((alerta) => alerta.tipo === tipo).length;
  }

  static normalizeFeatures({ maquina, historico, leituras2h, leituras24h, leituras72h, leituras7d, alertas24h, alertas72h, alertas7d, alertasAtivos, now, ultimaLeitura }) {
    const historico24h = this.getWindow(historico, new Date(now.getTime() - (24 * 60 * 60 * 1000)));
    const stats2h = this.buildReadingsStats(leituras2h);
    const stats24h = this.buildReadingsStats(leituras24h);
    const stats72h = this.buildReadingsStats(leituras72h);
    const stats7d = this.buildReadingsStats(leituras7d);
    const tempoDesdeUltimaLeitura = this.calcularTempoDesdeUltimaLeituraHoras(ultimaLeitura, now);

    return {
      integridadeAtual: Number(maquina.integridade),
      scoreEstabilidadeAtual: Number(maquina.scoreEstabilidade),
      slopeIntegridade24h: this.calcularSlopePorSerie(historico24h, "integridade"),
      slopeIntegridade7d: this.calcularSlopePorSerie(historico, "integridade"),
      variacaoIntegridade24h: this.calcularVariacao(historico24h, "integridade"),
      slopeScoreEstabilidade24h: this.calcularSlopePorSerie(historico24h, "scoreEstabilidade"),
      temperaturaMedia2h: stats2h.temperaturaMedia,
      temperaturaMedia24h: stats24h.temperaturaMedia,
      vibracaoMedia2h: stats2h.vibracaoMedia,
      vibracaoMedia24h: stats24h.vibracaoMedia,
      vibracaoMedia7d: stats7d.vibracaoMedia,
      desvioTemperatura24h: stats24h.desvioTemperatura,
      desvioVibracao24h: stats24h.desvioVibracao,
      proporcaoLeiturasAcimaDoIdeal24h: stats24h.proporcaoAcimaIdeal,
      proporcaoLeiturasAcimaDoLimite24h: stats24h.proporcaoAcimaLimite,
      alertasAtivos: alertasAtivos.length,
      alertasUltimas24h: alertas24h.length,
      alertasUltimas72h: alertas72h.length,
      instabilidadesUltimas72h: this.countAlertsByType(alertas72h, "INSTABILIDADE"),
      tendenciasCurtasUltimas72h: this.countAlertsByType(alertas72h, "TENDENCIA_CURTA"),
      tendenciasLongasUltimas7d: this.countAlertsByType(alertas7d, "TENDENCIA_LONGA"),
      criticidadePeso: maquina.criticidade === "ALTA" ? 1 : maquina.criticidade === "MEDIA" ? 0.6 : 0.2,
      tempoDesdeUltimaLeitura,
      indiceVariabilidadeTemperatura24h: stats24h.indiceVariabilidadeTemperatura,
      indiceVariabilidadeVibracao24h: stats24h.indiceVariabilidadeVibracao,
      razaoVibracao2h24h: this.ratio(stats2h.vibracaoMedia, Math.max(Math.abs(stats24h.vibracaoMedia || 0), 1)),
      razaoVibracao24h7d: this.ratio(stats24h.vibracaoMedia, Math.max(Math.abs(stats7d.vibracaoMedia || 0), 1)),
      leituras24h: stats24h.count,
      leituras72h: stats72h.count,
      leituras7d: stats7d.count,
      alertasHistoricosSuficientes: alertas7d.length > 0 || alertasAtivos.length > 0
    };
  }

  static buildCoverage(features, historico, leituras7d, alertas7d, config = this.obterConfig()) {
    const coverage = {
      historicoIntegridadeSuficiente: historico.length >= config.minPontosHistorico,
      leituras24hSuficientes: (features.leituras24h || 0) >= config.minLeituras24h,
      leituras72hSuficientes: (features.leituras72h || 0) >= config.minLeituras72h,
      leituraRecenteDisponivel: Number.isFinite(features.tempoDesdeUltimaLeitura) &&
        features.tempoDesdeUltimaLeitura <= config.limiarLeituraRecenteHoras,
      baseAlertasSuficiente: alertas7d.length > 0 || (features.alertasAtivos || 0) > 0
    };

    const motivos = [];
    if (!coverage.historicoIntegridadeSuficiente) motivos.push(this.MOTIVOS.HISTORICO_INSUFICIENTE);
    if (!coverage.leituras24hSuficientes || !coverage.leituras72hSuficientes) motivos.push(this.MOTIVOS.LEITURAS_INSUFICIENTES);
    if (!coverage.leituraRecenteDisponivel) motivos.push(this.MOTIVOS.SEM_LEITURA_RECENTE);
    if (!coverage.baseAlertasSuficiente) motivos.push(this.MOTIVOS.BASE_ALERTAS_INSUFICIENTE);

    return { coverage, motivos };
  }

  static async buildMachineFeatureSet(maquinaId) {
    const config = this.obterConfig();
    const maquina = await MaquinaModel.findById(maquinaId, { include: { sensores: true } });

    if (!maquina) {
      throw new AppError("Maquina nao encontrada.", 404);
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - (this.LOOKBACK_DIAS * 24 * 60 * 60 * 1000));
    const seventyTwoHoursAgo = new Date(now.getTime() - (72 * 60 * 60 * 1000));
    const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    const twoHoursAgo = new Date(now.getTime() - (2 * 60 * 60 * 1000));

    const [historico, leituras7d, alertas7d, alertasAtivos] = await Promise.all([
      HistoricoIntegridadeModel.findSerieByMaquina(maquinaId, {
        limite: 200,
        dataInicio: sevenDaysAgo
      }),
      LeituraModel.findByMaquinaPeriodo(maquinaId, {
        dataInicio: sevenDaysAgo
      }),
      AlertaModel.findByMaquinaPeriodo(maquinaId, {
        dataInicio: sevenDaysAgo,
        tipos: this.TIPOS_ALERTA_SUPORTADOS
      }),
      AlertaModel.findByMaquinaPeriodo(maquinaId, {
        tipos: this.TIPOS_ALERTA_SUPORTADOS,
        statuses: this.STATUS_ALERTA_ATIVO
      })
    ]);

    const leituras72h = this.getWindow(leituras7d, seventyTwoHoursAgo);
    const leituras24h = this.getWindow(leituras7d, twentyFourHoursAgo);
    const leituras2h = this.getWindow(leituras7d, twoHoursAgo);
    const alertas72h = this.getWindow(alertas7d, seventyTwoHoursAgo);
    const alertas24h = this.getWindow(alertas7d, twentyFourHoursAgo);
    const ultimaLeitura = this.obterUltimaLeitura(maquina, leituras7d);

    const features = this.normalizeFeatures({
      maquina,
      historico,
      leituras2h,
      leituras24h,
      leituras72h,
      leituras7d,
      alertas24h,
      alertas72h,
      alertas7d,
      alertasAtivos,
      now,
      ultimaLeitura
    });

    const { coverage, motivos } = this.buildCoverage(features, historico, leituras7d, alertas7d, config);

    return {
      maquina,
      features,
      coverage,
      motivosCobertura: motivos,
      metadados: {
        pontosHistoricoIntegridade: historico.length,
        leiturasConsideradas: leituras7d.length,
        alertasRecentesConsiderados: alertas72h.length,
        alertasHistoricosConsiderados: alertas7d.length,
        alertasAtivosConsiderados: alertasAtivos.length,
        ultimaLeituraEm: ultimaLeitura
      }
    };
  }
}

module.exports = FeatureEngineeringService;
