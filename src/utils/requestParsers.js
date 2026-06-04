const AppError = require("./appErrorUtils");

function normalizeLimit(value, fallback = 10, { min = 1, max = 20 } = {}) {
  const parsed = Number(value);
  const baseValue = Number.isFinite(parsed) ? parsed : fallback;

  return Math.min(Math.max(baseValue, min), max);
}

function parseFiniteNumber(value, message = "Valor invalido.") {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new AppError(message, 400);
  }

  return parsed;
}

function parseIntegerId(value, message = "Id invalido.") {
  const parsed = parseFiniteNumber(value, message);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(message, 400);
  }

  return parsed;
}

function parseBooleanLike(value, fallback = undefined) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }

  return fallback;
}

module.exports = {
  normalizeLimit,
  parseFiniteNumber,
  parseIntegerId,
  parseBooleanLike
};
