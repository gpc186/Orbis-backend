const { randomUUID } = require("node:crypto");
const AiActionConfirmationModel = require("../models/aiActionConfirmationModel");
const AppError = require("../utils/appErrorUtils");
const logger = require("../utils/logger");

class AiConfirmationService {
  static wrapPersistenceError(error) {
    const missingTable =
      String(error?.message || "").includes("AiActionConfirmation") &&
      String(error?.message || "").includes("does not exist");

    if (missingTable) {
      logger.error("ai_confirmation_table_missing", { error });

      const appError = new AppError(
        "A confirmação da IA não está disponível porque a migration correspondente ainda não foi aplicada no banco.",
        500
      );

      appError.skipFallback = true;
      throw appError;
    }

    throw error;
  }

  static getTtlMs() {
    const value = Number(process.env.AI_CONFIRMATION_TTL_MS || 10 * 60 * 1000);
    if (!Number.isFinite(value) || value <= 0) {
      return 10 * 60 * 1000;
    }

    return value;
  }

  static async cleanupExpired() {
    try {
      await AiActionConfirmationModel.expirePending(new Date());
    } catch (error) {
      this.wrapPersistenceError(error);
    }
  }

  static async create({ usuario, action, actionLabel, summary }) {
    await this.cleanupExpired();

    const id = randomUUID();
    const createdAt = Date.now();
    const expiresAt = new Date(createdAt + this.getTtlMs());

    try {
      await AiActionConfirmationModel.create({
        id,
        usuarioId: usuario.id,
        actionName: action.name,
        actionData: action,
        actionLabel,
        summary,
        expiresAt
      });
    } catch (error) {
      this.wrapPersistenceError(error);
    }

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

    let pending = null;

    try {
      pending = await AiActionConfirmationModel.findById(id);
    } catch (error) {
      this.wrapPersistenceError(error);
    }

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

    try {
      await AiActionConfirmationModel.markStatus({
        id,
        status: "CANCELLED"
      });
    } catch (error) {
      this.wrapPersistenceError(error);
    }

    return pending;
  }

  static async confirmSuccess({ id, usuario }) {
    const pending = await this.getPending({ id, usuario });

    try {
      await AiActionConfirmationModel.markStatus({
        id,
        status: "CONFIRMED"
      });
    } catch (error) {
      this.wrapPersistenceError(error);
    }

    return pending;
  }
}

module.exports = AiConfirmationService;
