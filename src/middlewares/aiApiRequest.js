const AppError = require("../utils/appErrorUtils");

const buckets = new Map();

function aiUserRateLimit(req, res, next) {
    const windowMs = 180 * 1000;
    const maxRequests = 3;
    try {
        const userId = req?.usuario?.id;
        if (!userId) {
            throw new AppError("Usuário não autenticado para uso da IA.", 401);
        }

        const key = String(userId);
        const now = Date.now();

        const timestamps = buckets.get(key) || [];

        const valid = timestamps.filter((ts) => now - ts <= windowMs);

        if (valid.length >= maxRequests) {
            throw new AppError(
                "Limite de perguntas para IA atingido. Tente novamente em alguns instantes.",
                429
            );
        }

        valid.push(now);
        buckets.set(key, valid);

        next();
    } catch (error) {
        next(error);
    }
};

module.exports = aiUserRateLimit;