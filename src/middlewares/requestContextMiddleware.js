const crypto = require("crypto");
const logger = require("../utils/logger");
const { runWithRequestContext } = require("../utils/requestContextStorage");

function getSlowRequestThresholdMs() {
  const parsed = Number(process.env.REQUEST_SLOW_MS);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 1000;
}

function requestContextMiddleware(req, res, next) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  return runWithRequestContext({ requestId }, () => {
    req.requestId = requestId;
    res.locals.requestId = requestId;
    res.setHeader("X-Request-Id", requestId);

    logger.info("request_started", {
      requestId,
      method: req.method,
      path: req.originalUrl || req.path,
      ip: req.ip,
      userAgent: req.get("user-agent") || null
    });

    res.on("finish", () => {
      const durationMs = Date.now() - startedAt;
      const context = {
        requestId,
        method: req.method,
        path: req.originalUrl || req.path,
        statusCode: res.statusCode,
        durationMs,
        ip: req.ip,
        userAgent: req.get("user-agent") || null,
        usuarioId: req.usuario?.id ?? null,
        usuarioRole: req.usuario?.role ?? null
      };

      logger.info("request_finished", context);

      if (durationMs >= getSlowRequestThresholdMs()) {
        logger.warn("request_slow", context);
      }
    });

    return next();
  });
}

module.exports = requestContextMiddleware;
