const prisma = require("../prisma/prisma");

class RelatorioReadModel {
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

  static async findMaquinas({ filtros = {} }) {
    return prisma.maquina.findMany({
      where: this.buildMachineWhere(filtros),
      include: { sensores: true },
      orderBy: { nome: "asc" }
    });
  }

  static async findAlertas({ filtros = {}, range }) {
    return prisma.alerta.findMany({
      where: this.buildAlertWhere({ filtros, range }),
      include: {
        maquina: true,
        sensor: true,
        tecnico: {
          select: { id: true, nome: true, email: true }
        }
      },
      orderBy: { criadoEm: "desc" }
    });
  }

  static async countMaquinas({ filtros = {} }) {
    return prisma.maquina.count({
      where: this.buildMachineWhere(filtros)
    });
  }

  static async countSensoresOnline({ filtros = {} }) {
    return prisma.sensor.count({
      where: {
        ...this.buildSensorWhere(filtros),
        status: "ONLINE"
      }
    });
  }

  static async countAlertasAtivosNoPeriodo({ filtros = {}, range }) {
    return prisma.alerta.count({
      where: {
        ...this.buildAlertWhere({ filtros, range }),
        status: "ATIVO"
      }
    });
  }

  static async countMaquinasComAlertaAtivo({ filtros = {}, range }) {
    const items = await prisma.alerta.findMany({
      where: {
        ...this.buildAlertWhere({ filtros, range }),
        status: "ATIVO"
      },
      select: { maquinaId: true },
      distinct: ["maquinaId"]
    });

    return items.length;
  }

  static async countAlertasHoje({ filtros = {}, range, referenceDate = new Date() }) {
    const startOfDay = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      referenceDate.getDate()
    );

    const start = range.start > startOfDay ? range.start : startOfDay;

    if (start > range.end) {
      return 0;
    }

    return prisma.alerta.count({
      where: this.buildAlertWhere({
        filtros,
        range: {
          start,
          end: range.end
        }
      })
    });
  }

  static async countAlertasAtivosSemAtendimento({ filtros = {}, range }) {
    return prisma.alerta.count({
      where: {
        ...this.buildAlertWhere({ filtros, range }),
        status: "ATIVO",
        tecnicoId: null
      }
    });
  }
}

module.exports = RelatorioReadModel;
