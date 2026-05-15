class RelatorioPayloadMapper {
  static buildResumo({ maquinasAtivas, maquinasAltaImportancia, integridadeMedia, chamadosAbertos }) {
    return {
      maquinasAtivas,
      maquinasAltaImportancia,
      integridadeMedia: Number((integridadeMedia || 0).toFixed(1)),
      chamadosAbertos
    };
  }

  static buildDesempenho({ statusDasMaquinas, maquinasPorImportancia, integridadePorSetor }) {
    return {
      statusDasMaquinas: statusDasMaquinas || {
        operando: 0,
        emAlerta: 0,
        inativa: 0
      },
      maquinasPorImportancia: maquinasPorImportancia || {
        alta: 0,
        media: 0,
        baixa: 0
      },
      integridadePorSetor: Array.isArray(integridadePorSetor) ? integridadePorSetor : []
    };
  }

  static buildSensores(sensores) {
    return sensores || {
      online: 0,
      offline: 0,
      inativo: 0
    };
  }

  static buildChamados(chamados) {
    return Array.isArray(chamados) ? chamados : [];
  }

  static buildHistoricoTendencia(historicoTendencia) {
    return Array.isArray(historicoTendencia) ? historicoTendencia : [];
  }

  static build({
    periodoLabel,
    secoes,
    maquinasAtivas,
    maquinasAltaImportancia,
    integridadeMedia,
    chamadosAbertos,
    statusDasMaquinas,
    maquinasPorImportancia,
    integridadePorSetor,
    sensores,
    chamados,
    historicoTendencia
  }) {
    const includeSecoes = new Set(secoes || []);

    return {
      periodoLabel,
      resumo: includeSecoes.has("resumo")
        ? this.buildResumo({
            maquinasAtivas,
            maquinasAltaImportancia,
            integridadeMedia,
            chamadosAbertos
          })
        : null,
      desempenho: includeSecoes.has("desempenho")
        ? this.buildDesempenho({
            statusDasMaquinas,
            maquinasPorImportancia,
            integridadePorSetor
          })
        : null,
      sensores: includeSecoes.has("sensores")
        ? this.buildSensores(sensores)
        : null,
      chamados: includeSecoes.has("chamados")
        ? this.buildChamados(chamados)
        : null,
      historicoTendencia: includeSecoes.has("historicoTendencia")
        ? this.buildHistoricoTendencia(historicoTendencia)
        : null
    };
  }
}

module.exports = RelatorioPayloadMapper;
