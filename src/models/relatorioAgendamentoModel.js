const prisma = require("../prisma/prisma");

class RelatorioAgendamentoModel {
  static baseInclude() {
    return {
      criadoPor: {
        select: {
          id: true,
          nome: true,
          email: true,
          role: true
        }
      },
      destinatarios: {
        orderBy: { email: "asc" }
      }
    };
  }

  static async create({ data, emailsDestino }) {
    return prisma.relatorioAgendamento.create({
      data: {
        ...data,
        destinatarios: {
          create: emailsDestino.map((email) => ({ email }))
        }
      },
      include: this.baseInclude()
    });
  }

  static async findAll() {
    return prisma.relatorioAgendamento.findMany({
      orderBy: { criadoEm: "desc" },
      include: this.baseInclude()
    });
  }

  static async findById(id) {
    return prisma.relatorioAgendamento.findUnique({
      where: { id: Number(id) },
      include: this.baseInclude()
    });
  }

  static async update({ id, data, emailsDestino }) {
    const agendamentoId = Number(id);

    return prisma.$transaction(async (tx) => {
      if (Array.isArray(emailsDestino)) {
        await tx.relatorioDestinatario.deleteMany({
          where: { agendamentoId }
        });
      }

      return tx.relatorioAgendamento.update({
        where: { id: agendamentoId },
        data: {
          ...data,
          ...(Array.isArray(emailsDestino)
            ? {
                destinatarios: {
                  create: emailsDestino.map((email) => ({ email }))
                }
              }
            : {})
        },
        include: this.baseInclude()
      });
    });
  }

  static async updateStatus(id, status) {
    return prisma.relatorioAgendamento.update({
      where: { id: Number(id) },
      data: { status },
      include: this.baseInclude()
    });
  }

  static async delete(id) {
    return prisma.relatorioAgendamento.delete({
      where: { id: Number(id) }
    });
  }

  static async listDue(referenceDate, limit = 20) {
    return prisma.relatorioAgendamento.findMany({
      where: {
        status: "ATIVO",
        proximoEnvioEm: { lte: referenceDate },
        OR: [
          { lockedAt: null },
          { lockedAt: { lt: new Date(referenceDate.getTime() - 10 * 60 * 1000) } }
        ]
      },
      take: limit,
      orderBy: { proximoEnvioEm: "asc" },
      include: this.baseInclude()
    });
  }

  static async tryLock(id, lockedAt = new Date()) {
    const result = await prisma.relatorioAgendamento.updateMany({
      where: {
        id: Number(id),
        OR: [
          { lockedAt: null },
          { lockedAt: { lt: new Date(lockedAt.getTime() - 10 * 60 * 1000) } }
        ]
      },
      data: { lockedAt }
    });

    return result.count > 0;
  }

  static async clearLock(id) {
    return prisma.relatorioAgendamento.update({
      where: { id: Number(id) },
      data: { lockedAt: null }
    });
  }

  static async markSuccess({ id, sentAt, nextRunAt }) {
    return prisma.relatorioAgendamento.update({
      where: { id: Number(id) },
      data: {
        lockedAt: null,
        ultimoEnvioEm: sentAt,
        ultimoSucessoEm: sentAt,
        ultimoErroEm: null,
        proximoEnvioEm: nextRunAt
      }
    });
  }

  static async markError({ id, errorMessage }) {
    return prisma.relatorioAgendamento.update({
      where: { id: Number(id) },
      data: {
        lockedAt: null,
        status: "ERRO",
        ultimoErroEm: errorMessage
      }
    });
  }
}

module.exports = RelatorioAgendamentoModel;
