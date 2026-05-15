const DashboardService = require("./dashboardService");
const RelatorioReadModel = require("../models/relatorioReadModel");

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
    const includeEntities = new Set(filtros.entidades || []);
    const includeResumo = includeEntities.has("resumo");

    const [
      maquinas,
      alertas,
      sensoresOnline,
      alertasAtivosNoPeriodo,
      totalMaquinasFiltradas,
      maquinasEmAlertaNoPeriodo,
      alertasHojeNoPeriodo,
      alertaSemAtendimentoNoPeriodo,
      resumoGlobal
    ] = await Promise.all([
      includeEntities.has("maquinas") ? RelatorioReadModel.findMaquinas({ filtros }) : [],
      includeEntities.has("alertas") ? RelatorioReadModel.findAlertas({ filtros, range }) : [],
      includeResumo ? RelatorioReadModel.countSensoresOnline({ filtros }) : 0,
      includeResumo ? RelatorioReadModel.countAlertasAtivosNoPeriodo({ filtros, range }) : 0,
      includeResumo ? RelatorioReadModel.countMaquinas({ filtros }) : 0,
      includeResumo ? RelatorioReadModel.countMaquinasComAlertaAtivo({ filtros, range }) : 0,
      includeResumo ? RelatorioReadModel.countAlertasHoje({ filtros, range }) : 0,
      includeResumo ? RelatorioReadModel.countAlertasAtivosSemAtendimento({ filtros, range }) : 0,
      includeResumo ? DashboardService.resume() : []
    ]);

    const resumo = includeResumo
      ? {
          ...resumoGlobal,
          totalMaquinas: totalMaquinasFiltradas,
          maquinasEmAlerta: maquinasEmAlertaNoPeriodo,
          alertasAtivos: alertasAtivosNoPeriodo,
          alertasHoje: alertasHojeNoPeriodo,
          sensoresOnline,
          alertaSemAtendimento: alertaSemAtendimentoNoPeriodo
        }
      : null;

    return {
      range,
      periodoLabel: range.label,
      resumo,
      maquinas,
      alertas
    };
  }
}

module.exports = RelatorioDataService;