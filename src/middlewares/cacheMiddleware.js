const DEFAULT_GET_TTL_MS = 5000;
const DEFAULT_DASHBOARD_TTL_MS = 10000;
const DEFAULT_MAX_ENTRIES = 500;

const cache = new Map();

function getEnvNumber(name, fallback, { min = 0 } = {}) {
  const parsed = Number(process.env[name]);

  if (!Number.isFinite(parsed) || parsed < min) {
    return fallback;
  }

  return parsed;
}

function getCacheKey(req) {
  const usuarioId = req.usuario?.id ?? "anon";
  const usuarioRole = req.usuario?.role ?? "anon";
  const url = req.originalUrl || req.url || "";

  return `${req.method}:${url}:user=${usuarioId}:role=${usuarioRole}`;
}

function cloneJson(value) {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value));
}

function getMaxEntries() {
  return getEnvNumber("CACHE_MAX_ENTRIES", DEFAULT_MAX_ENTRIES, { min: 1 });
}

function pruneExpiredEntries(now = Date.now()) {
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt <= now) {
      cache.delete(key);
    }
  }
}

function enforceMaxEntries(maxEntries) {
  while (cache.size > maxEntries) {
    const oldestKey = cache.keys().next().value;

    if (oldestKey === undefined) {
      return;
    }

    cache.delete(oldestKey);
  }
}

function createCacheMiddleware({ ttlMs } = {}) {
  return function cacheMiddleware(req, res, next) {
    if (req.method !== "GET") {
      res.setHeader("X-Cache", "BYPASS");
      return next();
    }

    const effectiveTtlMs = typeof ttlMs === "function"
      ? Number(ttlMs())
      : (Number.isFinite(Number(ttlMs))
          ? Number(ttlMs)
          : getEnvNumber("CACHE_GET_TTL_MS", DEFAULT_GET_TTL_MS));

    if (effectiveTtlMs <= 0) {
      res.setHeader("X-Cache", "BYPASS");
      return next();
    }

    const key = getCacheKey(req);
    const now = Date.now();
    pruneExpiredEntries(now);
    const cached = cache.get(key);

    if (cached && cached.expiresAt > now) {
      res.setHeader("X-Cache", "HIT");
      return res.status(cached.statusCode).json(cloneJson(cached.body));
    }

    if (cached) {
      cache.delete(key);
    }

    res.setHeader("X-Cache", "MISS");

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode === 200) {
        cache.delete(key);
        cache.set(key, {
          statusCode: res.statusCode,
          body: cloneJson(body),
          expiresAt: Date.now() + effectiveTtlMs
        });
        enforceMaxEntries(getMaxEntries());
      }

      return originalJson(body);
    };

    return next();
  };
}

function createDashboardCacheMiddleware() {
  return createCacheMiddleware({
    ttlMs: () => getEnvNumber("CACHE_DASHBOARD_TTL_MS", DEFAULT_DASHBOARD_TTL_MS)
  });
}

function clearCache() {
  cache.clear();
}

module.exports = {
  createCacheMiddleware,
  createDashboardCacheMiddleware,
  clearCache,
  pruneExpiredEntries
};
