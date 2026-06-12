const logger = require("./logger");
const { getRequestContext } = require("./requestContextStorage");

function getSlowQueryThresholdMs() {
  const parsed = Number(process.env.PRISMA_SLOW_QUERY_MS);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 250;
}

async function runQueryWithTiming({ model, operation, query, args }) {
  const startedAt = Date.now();

  try {
    return await query(args);
  } finally {
    const durationMs = Date.now() - startedAt;

    if (durationMs >= getSlowQueryThresholdMs()) {
      logger.warn("prisma_query_slow", {
        requestId: getRequestContext().requestId || null,
        model,
        operation,
        durationMs
      });
    }
  }
}

module.exports = {
  runQueryWithTiming
};
