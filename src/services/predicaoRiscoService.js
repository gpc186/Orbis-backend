const FeatureEngineeringService = require("./featureEngineeringService");

class PredicaoRiscoService {
  static MODEL_VERSION = "v2-node-risk-1";

  static round(value, digits = 2) {
    if (!Number.isFinite(Number(value))) return null;
    return Number(Number(value).toFixed(digits));
  }

  static clamp(value, min = 0, max = 1) {
    if (!Number.isFinite(Number(value))) return 0;
    return Math.min(max, Math.max(min, Number(value)));
  }

  static normalizeRange(value, min, max) {
    if (!Number.isFinite(Number(value))) return 0;
    if (max <= min) return 0;
    return this.clamp((Number(value) - min) / (max - min));
  }

  static inverseNormalizeRange(value, lowRisk, highRisk) {
    if (!Number.isFinite(Number(value))) return 0;
    if (highRisk <= lowRisk) return 0;
    return this.clamp((highRisk - Number(value)) / (highRisk - lowRisk));
  }

  static classifyRisk(prob24h, prob72h) {
    const reference = Math.max(prob24h ?? 0, prob72h ?? 0);

    if (!Number.isFinite(reference)) return null;
    if (reference >= 0.7) return "ALTO";
    if (reference >= 0.4) return "MEDIO";
    return "BAIXO";
  }

  static addContribution(contributions, name, normalizedValue, weight) {
    const normalized = this.clamp(normalizedValue);
    const contribution = this.clamp(normalized * weight);

    if (contribution > 0) {
      contributions.push({
        nome: name,
        valor: contribution
      });
    }

    return contribution;
  }

  static buildTopFactors(contributions, limit = 5) {
    return contributions
      .sort((a, b) => b.valor - a.valor)
      .slice(0, limit)
      .map((item) => item.nome);
  }

  static buildRiskUnavailable(motivoAusencia) {
    return {
      "24h": null,
      "72h": null,
      classificacao: null,
      motivoAusencia
    };
  }

  static buildRiskResult(prob24h, prob72h, contributions) {
    return {
      "24h": this.round(prob24h),
      "72h": this.round(prob72h),
      classificacao: this.classifyRisk(prob24h, prob72h),
      motivoAusencia: null,
      _contributions: contributions
    };
  }

  static shouldComputeInstabilidade({ coverage }) {
    if (!coverage.leituraRecenteDisponivel) {
      return { ok: false, motivo: FeatureEngineeringService.MOTIVOS.SEM_LEITURA_RECENTE };
    }

    if (!coverage.leituras24hSuficientes || !coverage.leituras72hSuficientes) {
      return { ok: false, motivo: FeatureEngineeringService.MOTIVOS.LEITURAS_INSUFICIENTES };
    }

    return { ok: true };
  }

  static shouldComputeAlerta({ coverage }) {
    if (!coverage.leituraRecenteDisponivel) {
      return { ok: false, motivo: FeatureEngineeringService.MOTIVOS.SEM_LEITURA_RECENTE };
    }

    if (!coverage.leituras24hSuficientes || !coverage.leituras72hSuficientes) {
      return { ok: false, motivo: FeatureEngineeringService.MOTIVOS.LEITURAS_INSUFICIENTES };
    }

    if (!coverage.baseAlertasSuficiente) {
      return { ok: false, motivo: FeatureEngineeringService.MOTIVOS.BASE_ALERTAS_INSUFICIENTE };
    }

    return { ok: true };
  }

  static shouldComputeManutencao({ coverage }) {
    if (!coverage.historicoIntegridadeSuficiente) {
      return { ok: false, motivo: FeatureEngineeringService.MOTIVOS.HISTORICO_INSUFICIENTE };
    }

    if (!coverage.leituraRecenteDisponivel) {
      return { ok: false, motivo: FeatureEngineeringService.MOTIVOS.SEM_LEITURA_RECENTE };
    }

    return { ok: true };
  }

  static calcularRiscoInstabilidade(contexto) {
    const gate = this.shouldComputeInstabilidade(contexto);
    if (!gate.ok) {
      return this.buildRiskUnavailable(gate.motivo);
    }

    const { features } = contexto;
    const c24h = [];
    const c72h = [];

    const prob24h = this.clamp(
      this.addContribution(c24h, "proporcao_acima_limite_24h", this.normalizeRange(features.proporcaoLeiturasAcimaDoLimite24h, 0.02, 0.25), 0.24) +
      this.addContribution(c24h, "proporcao_acima_ideal_24h", this.normalizeRange(features.proporcaoLeiturasAcimaDoIdeal24h, 0.10, 0.70), 0.20) +
      this.addContribution(c24h, "desvio_vibracao_24h", this.normalizeRange(features.indiceVariabilidadeVibracao24h, 0.05, 0.35), 0.22) +
      this.addContribution(c24h, "desvio_temperatura_24h", this.normalizeRange(features.indiceVariabilidadeTemperatura24h, 0.02, 0.15), 0.12) +
      this.addContribution(c24h, "instabilidades_ultimas_72h", this.normalizeRange(features.instabilidadesUltimas72h, 0, 3), 0.12) +
      this.addContribution(c24h, "vibracao_media_2h", this.normalizeRange(features.razaoVibracao2h24h, 1.0, 1.35), 0.10)
    );

    const prob72h = this.clamp(
      this.addContribution(c72h, "risco_instabilidade_24h", prob24h, 0.35) +
      this.addContribution(c72h, "tendencias_curtas_72h", this.normalizeRange(features.tendenciasCurtasUltimas72h, 0, 2), 0.15) +
      this.addContribution(c72h, "tendencias_longas_7d", this.normalizeRange(features.tendenciasLongasUltimas7d, 0, 2), 0.10) +
      this.addContribution(c72h, "queda_integridade_24h", this.normalizeRange(-features.slopeIntegridade24h, 0.02, 0.25), 0.15) +
      this.addContribution(c72h, "queda_estabilidade_24h", this.normalizeRange(-features.slopeScoreEstabilidade24h, 0.02, 0.25), 0.10) +
      this.addContribution(c72h, "vibracao_media_7d", this.normalizeRange(features.razaoVibracao24h7d, 1.0, 1.25), 0.10) +
      this.addContribution(c72h, "alertas_recentes_72h", this.normalizeRange(features.alertasUltimas72h, 0, 4), 0.05)
    );

    return this.buildRiskResult(prob24h, prob72h, [...c24h, ...c72h]);
  }

  static calcularRiscoAlerta(contexto) {
    const gate = this.shouldComputeAlerta(contexto);
    if (!gate.ok) {
      return this.buildRiskUnavailable(gate.motivo);
    }

    const { features } = contexto;
    const c24h = [];
    const c72h = [];

    const prob24h = this.clamp(
      this.addContribution(c24h, "proporcao_acima_limite_24h", this.normalizeRange(features.proporcaoLeiturasAcimaDoLimite24h, 0.02, 0.25), 0.25) +
      this.addContribution(c24h, "alertas_ativos", this.normalizeRange(features.alertasAtivos, 0, 3), 0.20) +
      this.addContribution(c24h, "alertas_recentes_24h", this.normalizeRange(features.alertasUltimas24h, 0, 3), 0.15) +
      this.addContribution(c24h, "proporcao_acima_ideal_24h", this.normalizeRange(features.proporcaoLeiturasAcimaDoIdeal24h, 0.10, 0.70), 0.10) +
      this.addContribution(c24h, "instabilidades_ultimas_72h", this.normalizeRange(features.instabilidadesUltimas72h, 0, 3), 0.10) +
      this.addContribution(c24h, "tendencias_curtas_72h", this.normalizeRange(features.tendenciasCurtasUltimas72h, 0, 2), 0.10) +
      this.addContribution(c24h, "queda_integridade_24h", this.normalizeRange(-features.slopeIntegridade24h, 0.02, 0.25), 0.10)
    );

    const prob72h = this.clamp(
      this.addContribution(c72h, "risco_alerta_24h", prob24h, 0.35) +
      this.addContribution(c72h, "alertas_recentes_72h", this.normalizeRange(features.alertasUltimas72h, 0, 5), 0.15) +
      this.addContribution(c72h, "tendencias_curtas_72h", this.normalizeRange(features.tendenciasCurtasUltimas72h, 0, 3), 0.15) +
      this.addContribution(c72h, "tendencias_longas_7d", this.normalizeRange(features.tendenciasLongasUltimas7d, 0, 3), 0.10) +
      this.addContribution(c72h, "instabilidades_ultimas_72h", this.normalizeRange(features.instabilidadesUltimas72h, 0, 3), 0.05) +
      this.addContribution(c72h, "queda_integridade_7d", this.normalizeRange(-features.slopeIntegridade7d, 0.01, 0.12), 0.10) +
      this.addContribution(c72h, "criticidade_maquina", features.criticidadePeso, 0.10)
    );

    return this.buildRiskResult(prob24h, prob72h, [...c24h, ...c72h]);
  }

  static calcularRiscoManutencao(contexto) {
    const gate = this.shouldComputeManutencao(contexto);
    if (!gate.ok) {
      return this.buildRiskUnavailable(gate.motivo);
    }

    const { features } = contexto;
    const c24h = [];
    const c72h = [];

    const prob24h = this.clamp(
      this.addContribution(c24h, "integridade_atual", this.inverseNormalizeRange(features.integridadeAtual, 40, 85), 0.28) +
      this.addContribution(c24h, "score_estabilidade_atual", this.inverseNormalizeRange(features.scoreEstabilidadeAtual, 40, 85), 0.15) +
      this.addContribution(c24h, "variacao_integridade_24h", this.normalizeRange(-features.variacaoIntegridade24h, 2, 20), 0.18) +
      this.addContribution(c24h, "queda_integridade_24h", this.normalizeRange(-features.slopeIntegridade24h, 0.05, 1.0), 0.15) +
      this.addContribution(c24h, "queda_estabilidade_24h", this.normalizeRange(-features.slopeScoreEstabilidade24h, 0.05, 1.0), 0.10) +
      this.addContribution(c24h, "alertas_ativos", this.normalizeRange(features.alertasAtivos, 0, 3), 0.09) +
      this.addContribution(c24h, "criticidade_maquina", features.criticidadePeso, 0.05)
    );

    const prob72h = this.clamp(
      this.addContribution(c72h, "integridade_atual", this.inverseNormalizeRange(features.integridadeAtual, 35, 90), 0.22) +
      this.addContribution(c72h, "score_estabilidade_atual", this.inverseNormalizeRange(features.scoreEstabilidadeAtual, 35, 90), 0.12) +
      this.addContribution(c72h, "queda_integridade_7d", this.normalizeRange(-features.slopeIntegridade7d, 0.01, 0.12), 0.20) +
      this.addContribution(c72h, "variacao_integridade_24h", this.normalizeRange(-features.variacaoIntegridade24h, 2, 20), 0.08) +
      this.addContribution(c72h, "tendencias_longas_7d", this.normalizeRange(features.tendenciasLongasUltimas7d, 0, 3), 0.10) +
      this.addContribution(c72h, "alertas_recentes_72h", this.normalizeRange(features.alertasUltimas72h, 0, 5), 0.08) +
      this.addContribution(c72h, "criticidade_maquina", features.criticidadePeso, 0.12) +
      this.addContribution(c72h, "alertas_ativos", this.normalizeRange(features.alertasAtivos, 0, 3), 0.08)
    );

    return this.buildRiskResult(prob24h, prob72h, [...c24h, ...c72h]);
  }

  static buildConfidence(contexto) {
    const { metadados, features } = contexto;
    const historyScore = this.clamp((metadados.pontosHistoricoIntegridade || 0) / 30);
    const readingsScore = this.clamp((metadados.leiturasConsideradas || 0) / 120);
    const recencyScore = features.tempoDesdeUltimaLeitura == null
      ? 0
      : features.tempoDesdeUltimaLeitura <= 1
        ? 1
        : features.tempoDesdeUltimaLeitura <= 6
          ? 0.8
          : features.tempoDesdeUltimaLeitura <= 24
            ? 0.5
            : 0.2;
    const alertsScore = (metadados.alertasHistoricosConsiderados || 0) > 0
      ? this.clamp((metadados.alertasHistoricosConsiderados || 0) / 5)
      : 0.5;

    return this.round(
      (historyScore * 0.35) +
      (readingsScore * 0.35) +
      (recencyScore * 0.20) +
      (alertsScore * 0.10)
    );
  }

  static consolidateFactors(riscos) {
    const allContributions = Object.values(riscos)
      .flatMap((risk) => Array.isArray(risk?._contributions) ? risk._contributions : []);

    const ranking = new Map();

    for (const contribution of allContributions) {
      const current = ranking.get(contribution.nome) || 0;
      ranking.set(contribution.nome, Math.max(current, contribution.valor));
    }

    return [...ranking.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);
  }

  static stripInternalFields(risk) {
    if (!risk) return risk;

    const { _contributions, ...publicRisk } = risk;
    return publicRisk;
  }

  static async preverPorMaquina(maquinaId) {
    const contexto = await FeatureEngineeringService.buildMachineFeatureSet(maquinaId);

    const riscos = {
      instabilidade: this.calcularRiscoInstabilidade(contexto),
      alerta: this.calcularRiscoAlerta(contexto),
      manutencao: this.calcularRiscoManutencao(contexto)
    };

    const fatoresPrincipais = this.consolidateFactors(riscos);
    const temAlgumRiscoCalculado = Object.values(riscos).some((risk) => risk["24h"] != null || risk["72h"] != null);

    return {
      maquinaId: contexto.maquina.id,
      modeloVersao: this.MODEL_VERSION,
      riscos: {
        instabilidade: this.stripInternalFields(riscos.instabilidade),
        alerta: this.stripInternalFields(riscos.alerta),
        manutencao: this.stripInternalFields(riscos.manutencao)
      },
      fatoresPrincipais,
      confiancaGeral: temAlgumRiscoCalculado ? this.buildConfidence(contexto) : null,
      metadados: {
        pontosHistoricoIntegridade: contexto.metadados.pontosHistoricoIntegridade,
        leiturasConsideradas: contexto.metadados.leiturasConsideradas,
        alertasRecentesConsiderados: contexto.metadados.alertasRecentesConsiderados
      }
    };
  }
}

module.exports = PredicaoRiscoService;
