const prisma = require("../prisma/prisma");
const { REPORT_TIMEZONE } = require("../utils/reportScheduleUtils");

class RelatorioReadModel {
  static getReportTimeZone() {
    return REPORT_TIMEZONE;
  }

  static buildMachineWhere(filtros = {}, { includeInactive = false } = {}) {
    const where = {};

    if (!includeInactive) {
      where.ativo = true;
    }

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

  static buildAlertWhere({ filtros = {}, range } = {}) {
    const where = {};

    if (range) {
      where.criadoEm = {
        gte: range.start,
        lte: range.end
      };
    }

    if (filtros.maquinasIds?.length) {
      where.maquinaId = { in: filtros.maquinasIds };
    }

    if (filtros.sensoresIds?.length) {
      where.sensorId = { in: filtros.sensoresIds };
    }

    if (filtros.usuariosIds?.length) {
      where.tecnicoId = { in: filtros.usuariosIds };
    }

    return where;
  }

  static formatDateKey(value) {
    const date = new Date(value);
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: this.getReportTimeZone(),
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date);

    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;

    return `${year}-${month}-${day}`;
  }

  static async countMaquinasAtivas({ filtros = {} }) {
    return prisma.maquina.count({
      where: this.buildMachineWhere(filtros)
    });
  }

  static async countMaquinasAltaImportancia({ filtros = {} }) {
    return prisma.maquina.count({
      where: {
        ...this.buildMachineWhere(filtros),
        criticidade: "ALTA"
      }
    });
  }

  static async calculateIntegridadeMedia({ filtros = {} }) {
    return prisma.maquina.aggregate({
      where: this.buildMachineWhere(filtros),
      _avg: { integridade: true }
    });
  }

  static async countChamadosAbertos({ filtros = {} }) {
    return prisma.alerta.count({
      where: {
        ...this.buildAlertWhere({ filtros }),
        status: "ATIVO"
      }
    });
  }

  static async findStatusDasMaquinas({ filtros = {} }) {
    const maquinas = await prisma.maquina.findMany({
      where: this.buildMachineWhere(filtros, { includeInactive: true }),
      select: {
        id: true,
        ativo: true
      }
    });

    const maquinasAtivasIds = maquinas
      .filter((maquina) => maquina.ativo)
      .map((maquina) => maquina.id);

    let maquinasComAlertaAtivo = [];

    if (maquinasAtivasIds.length > 0) {
      maquinasComAlertaAtivo = await prisma.alerta.findMany({
        where: {
          ...this.buildAlertWhere({ filtros }),
          maquinaId: { in: maquinasAtivasIds },
          status: "ATIVO"
        },
        select: { maquinaId: true },
        distinct: ["maquinaId"]
      });
    }

    const maquinasEmAlertaIds = new Set(maquinasComAlertaAtivo.map((item) => item.maquinaId));

    let operando = 0;
    let emAlerta = 0;
    let inativa = 0;

    for (const maquina of maquinas) {
      if (!maquina.ativo) {
        inativa += 1;
      } else if (maquinasEmAlertaIds.has(maquina.id)) {
        emAlerta += 1;
      } else {
        operando += 1;
      }
    }

    return { operando, emAlerta, inativa };
  }

  static async countMaquinasPorCriticidade({ filtros = {} }) {
    const grouped = await prisma.maquina.groupBy({
      by: ["criticidade"],
      where: this.buildMachineWhere(filtros, { includeInactive: true }),
      _count: { criticidade: true }
    });

    const result = {
      alta: 0,
      media: 0,
      baixa: 0
    };

    for (const item of grouped) {
      const key = String(item.criticidade || "").toLowerCase();
      result[key] = item._count.criticidade;
    }

    return result;
  }

  static async findIntegridadePorSetor({ filtros = {} }) {
    const grouped = await prisma.maquina.groupBy({
      by: ["setor"],
      where: this.buildMachineWhere(filtros),
      _avg: { integridade: true },
      orderBy: { setor: "asc" }
    });

    return grouped.map((item) => ({
      setor: item.setor,
      integridadeMedia: Number((item._avg.integridade || 0).toFixed(1))
    }));
  }

  static async countSensoresPorStatus({ filtros = {} }) {
    const grouped = await prisma.sensor.groupBy({
      by: ["status"],
      where: this.buildSensorWhere(filtros),
      _count: { status: true }
    });

    const result = {
      online: 0,
      offline: 0,
      inativo: 0
    };

    for (const item of grouped) {
      const key = String(item.status || "").toLowerCase();
      result[key] = item._count.status;
    }

    return result;
  }

  static async findChamados({ filtros = {}, range }) {
    const alertas = await prisma.alerta.findMany({
      where: this.buildAlertWhere({ filtros, range }),
      include: {
        maquina: {
          select: { id: true, nome: true }
        },
        sensor: {
          select: { id: true, tipo: true }
        },
        tecnico: {
          select: { id: true, nome: true, email: true }
        }
      },
      orderBy: { criadoEm: "desc" }
    });

    return alertas.map((alerta) => ({
      id: alerta.id,
      maquina: alerta.maquina?.nome || null,
      sensor: alerta.sensor?.tipo || null,
      tipo: alerta.tipo,
      status: alerta.status,
      tecnico: alerta.tecnico
        ? {
            id: alerta.tecnico.id,
            nome: alerta.tecnico.nome,
            email: alerta.tecnico.email
          }
        : null,
      criadoEm: alerta.criadoEm
    }));
  }

  static async findHistoricoTendencia({ filtros = {}, range }) {
    const alertas = await prisma.alerta.findMany({
      where: this.buildAlertWhere({ filtros, range }),
      select: { criadoEm: true },
      orderBy: { criadoEm: "asc" }
    });

    const counters = new Map();

    for (const alerta of alertas) {
      const key = this.formatDateKey(alerta.criadoEm);
      counters.set(key, (counters.get(key) || 0) + 1);
    }

    const historico = [];
    const cursor = new Date(range.start);
    cursor.setHours(0, 0, 0, 0);

    const end = new Date(range.end);
    end.setHours(0, 0, 0, 0);

    while (cursor <= end) {
      const key = this.formatDateKey(cursor);
      historico.push({
        data: key,
        quantidade: counters.get(key) || 0
      });

      cursor.setDate(cursor.getDate() + 1);
    }

    return historico;
  }
}

module.exports = RelatorioReadModel;
