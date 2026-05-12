const AppError = require("../utils/appErrorUtils");

const buckets = new Map();

function contactRateLimit({ windowMs = 60_000, maxRequests = 3 } = {}) {
  return (req, _res, next) => {
    const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
    const key = String(ip);
    const now = Date.now();

    const timestamps = buckets.get(key) || [];
    const valid = timestamps.filter((ts) => now - ts <= windowMs);

    if (valid.length >= maxRequests) {
      return next(new AppError("Muitas tentativas. Tente novamente em instantes.", 429));
    }

    valid.push(now);
    buckets.set(key, valid);

    return next();
  };
}

module.exports = contactRateLimit;