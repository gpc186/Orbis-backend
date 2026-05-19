const { gerarRelatorioHTML } = require("../templates/reportTemplate");
const RelatorioDataService = require("./relatorioDataService");

const SECTION_LABELS = {
  resumo: "Resumo",
  desempenho: "Desempenho",
  sensores: "Sensores",
  chamados: "Chamados",
  historicoTendencia: "Historico de tendencia"
};

class RelatorioRendererService {
  static buildEscopo(filtros = {}) {
    const maquinasIds = Array.isArray(filtros.maquinasIds) ? filtros.maquinasIds : [];
    const sensoresIds = Array.isArray(filtros.sensoresIds) ? filtros.sensoresIds : [];
    const usuariosIds = Array.isArray(filtros.usuariosIds) ? filtros.usuariosIds : [];
    const secoes = Array.isArray(filtros.secoes) ? filtros.secoes : [];

    const abrangencia = [];
    const secoesLabel = secoes
      .map((secao) => SECTION_LABELS[secao] || secao)
      .join(", ");

    if (maquinasIds.length > 0) {
      abrangencia.push(
        maquinasIds.length === 1
          ? "1 maquina filtrada"
          : `${maquinasIds.length} maquinas filtradas`
      );
    }

    if (sensoresIds.length > 0) {
      abrangencia.push(
        sensoresIds.length === 1
          ? "1 sensor filtrado"
          : `${sensoresIds.length} sensores filtrados`
      );
    }

    if (usuariosIds.length > 0) {
      abrangencia.push(
        usuariosIds.length === 1
          ? "1 tecnico filtrado"
          : `${usuariosIds.length} tecnicos filtrados`
      );
    }

    if (abrangencia.length === 0) {
      abrangencia.push("Abrangencia completa");
    }

    if (!secoesLabel) {
      return abrangencia.join(" · ");
    }

    return `${abrangencia.join(" · ")} · Secoes: ${secoesLabel}`;
  }

  static buildSubject({ nome, periodoLabel, assunto }) {
    if (assunto) return assunto;
    if (nome) return `${nome} - ${periodoLabel}`;
    return `Relatorio Operacional Orbis - ${periodoLabel}`;
  }

  static buildTextFallback({ periodoLabel }) {
    return [
      "Relatorio operacional Orbis",
      `Periodo: ${periodoLabel}`,
      "Abra o email em modo HTML para visualizar os detalhes."
    ].join("\n");
  }

  static async render({ nome, assunto, periodo, filtros }) {
    const data = await RelatorioDataService.collect({ periodo, filtros });
    const periodoLabel = data.periodoLabel;
    const escopo = this.buildEscopo(filtros);
    const html = gerarRelatorioHTML({ data, config: { nome, periodoLabel, escopo } });

    return {
      subject: this.buildSubject({ nome, periodoLabel, assunto }),
      text: this.buildTextFallback({ periodoLabel }),
      html,
      periodoLabel,
      data
    };
  }
}

module.exports = RelatorioRendererService;
