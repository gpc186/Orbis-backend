const crypto = require("crypto");
const logger = require("../utils/logger");

function requestContextMiddleware(req, res, next) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

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
    logger.info("request_finished", {
      requestId,
      method: req.method,
      path: req.originalUrl || req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
      ip: req.ip,
      userAgent: req.get("user-agent") || null,
      usuarioId: req.usuario?.id ?? null,
      usuarioRole: req.usuario?.role ?? null
    });
  });

  next();
}

module.exports = requestContextMiddleware;
