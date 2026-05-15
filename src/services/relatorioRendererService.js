const { gerarRelatorioHTML } = require("../templates/reportTemplate");
const RelatorioDataService = require("./relatorioDataService");

class RelatorioRendererService {
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
    const html = gerarRelatorioHTML({ data, config: { nome, periodoLabel } });

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
