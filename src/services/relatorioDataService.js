const RelatorioReadModel = require("../models/relatorioReadModel");
const RelatorioPayloadMapper = require("../mappers/relatorioPayloadMapper");

class RelatorioDataService {
  static resolveDateRange(periodo) {
    if (periodo.tipo === "RELATIVE_DAYS") {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - Number(periodo.valor || 30));

      return {
        start,
        end,
        label: `${periodo.valor} dias`
      };
    }

    const start = new Date(periodo.inicio);
    const end = new Date(periodo.fim);

    return {
      start,
      end,
      label: `${start.toLocaleDateString("pt-BR")} ate ${end.toLocaleDateString("pt-BR")}`
    };
  }

  static async collect({ periodo, filtros }) {
    const range = this.resolveDateRange(periodo);
    const secoes = filtros.secoes || [];
    const includeResumo = secoes.includes("resumo");
    const includeDesempenho = secoes.includes("desempenho");
    const includeSensores = secoes.includes("sensores");
    const includeChamados = secoes.includes("chamados");
    const includeHistoricoTendencia = secoes.includes("historicoTendencia");

    const [
      maquinasAtivas,
      maquinasAltaImportancia,
      integridadeMediaAgg,
      chamadosAbertos,
      statusDasMaquinas,
      maquinasPorImportancia,
      integridadePorSetor,
      sensores,
      chamados,
      historicoTendencia
    ] = await Promise.all([
      includeResumo ? RelatorioReadModel.countMaquinasAtivas({ filtros }) : 0,
      includeResumo ? RelatorioReadModel.countMaquinasAltaImportancia({ filtros }) : 0,
      includeResumo ? RelatorioReadModel.calculateIntegridadeMedia({ filtros }) : null,
      includeResumo ? RelatorioReadModel.countChamadosAbertos({ filtros }) : 0,
      includeDesempenho ? RelatorioReadModel.findStatusDasMaquinas({ filtros }) : null,
      includeDesempenho ? RelatorioReadModel.countMaquinasPorCriticidade({ filtros }) : null,
      includeDesempenho ? RelatorioReadModel.findIntegridadePorSetor({ filtros }) : [],
      includeSensores ? RelatorioReadModel.countSensoresPorStatus({ filtros }) : null,
      includeChamados ? RelatorioReadModel.findChamados({ filtros, range }) : [],
      includeHistoricoTendencia ? RelatorioReadModel.findHistoricoTendencia({ filtros, range }) : []
    ]);

    return RelatorioPayloadMapper.build({
      periodoLabel: range.label,
      secoes,
      maquinasAtivas,
      maquinasAltaImportancia,
      integridadeMedia: integridadeMediaAgg?._avg?.integridade || 0,
      chamadosAbertos,
      statusDasMaquinas,
      maquinasPorImportancia,
      integridadePorSetor,
      sensores,
      chamados,
      historicoTendencia
    });
  }
}

module.exports = RelatorioDataService;
