const prisma = require("../prisma/prisma");
const DashboardService = require("./dashboardService");

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

  static buildMachineWhere(filtros = {}) {
    const where = { ativo: true };

    if (filtros.maquinasIds?.length) {
      where.id = { in: filtros.maquinasIds };
    }

    return where;
  }

  static buildSensorWhere(filtros = {}) {
    const where = {};

    if (filtros.sensoresIds?.length) {
      where.id = { in: filtros.sensoresIds };
    }

    if (filtros.maquinasIds?.length) {
      where.maquinaId = { in: filtros.maquinasIds };
    }

    return where;
  }

  static buildAlertWhere({ filtros = {}, range }) {
    const where = {
      criadoEm: {
        gte: range.start,
        lte: range.end
      }
    };

    if (filtros.maquinasIds?.length) {
      where.maquinaId = { in: filtros.maquinasIds };
    }

    if (filtros.sensoresIds?.length) {
      where.sensorId = { in: filtros.sensoresIds };
    }

    return where;
  }

  static async collect({ periodo, filtros }) {
    const range = this.resolveDateRange(periodo);
    const machineWhere = this.buildMachineWhere(filtros);
    const sensorWhere = this.buildSensorWhere(filtros);
    const alertWhere = this.buildAlertWhere({ filtros, range });
    const includeEntities = new Set(filtros.entidades || []);

    const [maquinas, alertas, sensoresOnline, alertasAtivosNoPeriodo, resumoGlobal] = await Promise.all([
      includeEntities.has("maquinas")
        ? prisma.maquina.findMany({
            where: machineWhere,
            include: { sensores: true },
            orderBy: { nome: "asc" }
          })
        : [],
      includeEntities.has("alertas")
        ? prisma.alerta.findMany({
            where: alertWhere,
            include: {
              maquina: true,
              sensor: true,
              tecnico: {
                select: { id: true, nome: true, email: true }
              }
            },
            orderBy: { criadoEm: "desc" }
          })
        : [],
      prisma.sensor.count({
        where: {
          ...sensorWhere,
          status: "ONLINE"
        }
      }),
      prisma.alerta.count({
        where: {
          ...alertWhere,
          status: "ATIVO"
        }
      }),
      DashboardService.resume()
    ]);

    const resumo = includeEntities.has("resumo")
      ? {
          ...resumoGlobal,
          totalMaquinas: maquinas.length || resumoGlobal.totalMaquinas,
          maquinasEmAlerta: [...new Set(alertas.filter((item) => item.status === "ATIVO").map((item) => item.maquinaId))].length,
          alertasAtivos: alertasAtivosNoPeriodo,
          alertasHoje: alertas.filter((item) => {
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            return new Date(item.criadoEm) >= startOfDay;
          }).length,
          sensoresOnline,
          alertaSemAtendimento: alertas.filter((item) => item.status === "ATIVO" && !item.tecnicoId).length
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
