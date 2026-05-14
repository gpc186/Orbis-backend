// src/models/passwordResetCodeModel.js

const prisma = require("../prisma/prisma");

class ResetSenhaModel {
  static async upsert({ usuarioId, code, emailDestino, expiresAt }) {
    return prisma.passwordResetCode.upsert({
      where: { usuarioId },
      update: { code, emailDestino, expiresAt },
      create: { code, usuarioId, emailDestino, expiresAt }
    });
  }

  static async findByUsuarioId(usuarioId) {
    return prisma.passwordResetCode.findUnique({
      where: { usuarioId }
    });
  }

  static async deleteByUsuarioId(usuarioId) {
    return prisma.passwordResetCode.delete({
      where: { usuarioId }
    });
  }
}

module.exports = ResetSenhaModel;