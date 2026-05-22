const { randomUUID } = require("node:crypto");
const AiActionConfirmationModel = require("../models/aiActionConfirmationModel");
const AppError = require("../utils/appErrorUtils");

class AiConfirmationService {

  static getTtlMs() {
    const value = Number(process.env.AI_CONFIRMATION_TTL_MS || 10 * 60 * 1000);
    if (!Number.isFinite(value) || value <= 0) {
      return 10 * 60 * 1000;
    }

    return value;
  }

  static async cleanupExpired() {
    await AiActionConfirmationModel.expirePending(new Date());
  }

  static async create({ usuario, action, actionLabel, summary }) {
    await this.cleanupExpired();

    const id = randomUUID();
    const createdAt = Date.now();
    const expiresAt = new Date(createdAt + this.getTtlMs());

    await AiActionConfirmationModel.create({
      id,
      usuarioId: usuario.id,
      actionName: action.name,
      actionData: action,
      actionLabel,
      summary,
      expiresAt
    });

    return {
      id,
      actionName: action.name,
      actionLabel,
      summary,
      expiresAt: expiresAt.toISOString()
    };
  }

  static async getPending({ id, usuario }) {
    await this.cleanupExpired();

    const pending = await AiActionConfirmationModel.findById(id);

    if (!pending || pending.status !== "PENDING") {
      throw new AppError("Confirmacao pendente nao encontrada ou expirada.", 400);
    }

    if (pending.expiresAt <= new Date()) {
      await AiActionConfirmationModel.markStatus({
        id,
        status: "EXPIRED"
      });

      throw new AppError("Confirmacao pendente nao encontrada ou expirada.", 400);
    }

    if (!usuario || pending.usuarioId !== usuario.id) {
      throw new AppError("Voce nao pode confirmar esta acao pendente.", 403);
    }

    return pending;
  }

  static async cancel({ id, usuario }) {
    const pending = await this.getPending({ id, usuario });

    await AiActionConfirmationModel.markStatus({
      id,
      status: "CANCELLED"
    });

    return pending;
  }

  static async confirmSuccess({ id, usuario }) {
    const pending = await this.getPending({ id, usuario });

    await AiActionConfirmationModel.markStatus({
      id,
      status: "CONFIRMED"
    });

    return pending;
  }
}

module.exports = AiConfirmationService;
