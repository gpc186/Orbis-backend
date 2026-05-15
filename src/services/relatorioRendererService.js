const { gerarRelatorioHTML } = require("../templates/reportTemplate");
const RelatorioDataService = require("./relatorioDataService");

class RelatorioRendererService {
  static buildEscopo(filtros = {}) {
    const maquinasIds = Array.isArray(filtros.maquinasIds) ? filtros.maquinasIds : [];

    if (maquinasIds.length === 0) return "Completo";
    if (maquinasIds.length === 1) return "Maquina especifica";
    return "Multiplas maquinas";
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
