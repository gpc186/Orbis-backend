const prisma = require("../prisma/prisma");

class AiActionConfirmationModel {
  static async create({ id, usuarioId, actionName, actionData, actionLabel, summary, expiresAt }) {
    return prisma.aiActionConfirmation.create({
      data: {
        id,
        usuarioId,
        actionName,
        actionData,
        actionLabel,
        summary,
        expiresAt
      }
    });
  }

  static async findById(id) {
    return prisma.aiActionConfirmation.findUnique({
      where: { id }
    });
  }

  static async markStatus({ id, status, resolvedAt = new Date() }) {
    return prisma.aiActionConfirmation.update({
      where: { id },
      data: {
        status,
        resolvedAt
      }
    });
  }

  static async expirePending(referenceDate = new Date()) {
    return prisma.aiActionConfirmation.updateMany({
      where: {
        status: "PENDING",
        expiresAt: { lte: referenceDate }
      },
      data: {
        status: "EXPIRED",
        resolvedAt: referenceDate
      }
    });
  }
}

module.exports = AiActionConfirmationModel;
