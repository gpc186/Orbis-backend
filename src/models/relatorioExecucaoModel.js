const prisma = require("../prisma/prisma");

class RelatorioExecucaoModel {
  static async create(data) {
    return prisma.relatorioExecucao.create({ data });
  }

  static async markSuccess(id, { provider, messageId, finalizadoEm, status = "ENVIADO" }) {
    return prisma.relatorioExecucao.update({
      where: { id: Number(id) },
      data: {
        provider,
        messageId,
        status,
        finalizadoEm
      }
    });
  }

  static async markFailure(id, { errorMessage, finalizadoEm }) {
    return prisma.relatorioExecucao.update({
      where: { id: Number(id) },
      data: {
        erro: errorMessage,
        status: "FALHOU",
        finalizadoEm
      }
    });
  }

  static async findByAgendamentoId(agendamentoId) {
    return prisma.relatorioExecucao.findMany({
      where: { agendamentoId: Number(agendamentoId) },
      orderBy: { iniciadoEm: "desc" }
    });
  }
}

module.exports = RelatorioExecucaoModel;
