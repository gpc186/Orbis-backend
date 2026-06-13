const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");

const {
  createCacheMiddleware,
  clearCache
} = require("../../../src/middlewares/cacheMiddleware");

const originalCacheMaxEntries = process.env.CACHE_MAX_ENTRIES;

afterEach(() => {
  clearCache();

  if (originalCacheMaxEntries === undefined) {
    delete process.env.CACHE_MAX_ENTRIES;
  } else {
    process.env.CACHE_MAX_ENTRIES = originalCacheMaxEntries;
  }
});

function buildReq({
  method = "GET",
  originalUrl = "/maquinas",
  usuario = { id: 1, role: "ADMIN" }
} = {}) {
  return {
    method,
    originalUrl,
    url: originalUrl,
    usuario
  };
}

function buildRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

async function runCached({ req, statusCode = 200, body = { ok: true }, middleware = createCacheMiddleware({ ttlMs: 1000 }) }) {
  const res = buildRes();
  let handlerCalled = false;

  await new Promise((resolve) => {
    middleware(req, res, () => {
      handlerCalled = true;
      res.status(statusCode).json(body);
      resolve();
    });

    if (!handlerCalled) {
      resolve();
    }
  });

  return { res, handlerCalled };
}

test("cacheMiddleware retorna MISS no primeiro GET e HIT no segundo GET igual", async () => {
  const req = buildReq();

  const first = await runCached({ req, body: { items: [1] } });
  const second = await runCached({ req, body: { items: [2] } });

  assert.equal(first.handlerCalled, true);
  assert.equal(first.res.headers["x-cache"], "MISS");
  assert.deepEqual(first.res.body, { items: [1] });
  assert.equal(second.handlerCalled, false);
  assert.equal(second.res.headers["x-cache"], "HIT");
  assert.deepEqual(second.res.body, { items: [1] });
});

test("cacheMiddleware separa cache por usuario e role", async () => {
  const adminReq = buildReq({ usuario: { id: 1, role: "ADMIN" } });
  const tecnicoReq = buildReq({ usuario: { id: 2, role: "TECNICO" } });

  await runCached({ req: adminReq, body: { role: "ADMIN" } });
  const tecnico = await runCached({ req: tecnicoReq, body: { role: "TECNICO" } });

  assert.equal(tecnico.handlerCalled, true);
  assert.equal(tecnico.res.headers["x-cache"], "MISS");
  assert.deepEqual(tecnico.res.body, { role: "TECNICO" });
});

test("cacheMiddleware nao cacheia metodos de escrita", async () => {
  const middleware = createCacheMiddleware({ ttlMs: 1000 });
  const req = buildReq({ method: "POST" });

  const first = await runCached({ req, body: { count: 1 }, middleware });
  const second = await runCached({ req, body: { count: 2 }, middleware });

  assert.equal(first.res.headers["x-cache"], "BYPASS");
  assert.equal(second.res.headers["x-cache"], "BYPASS");
  assert.equal(first.handlerCalled, true);
  assert.equal(second.handlerCalled, true);
  assert.deepEqual(second.res.body, { count: 2 });
});

test("cacheMiddleware nao cacheia status diferente de 200", async () => {
  const req = buildReq();

  const first = await runCached({ req, statusCode: 500, body: { erro: true } });
  const second = await runCached({ req, statusCode: 200, body: { ok: true } });

  assert.equal(first.res.headers["x-cache"], "MISS");
  assert.equal(second.handlerCalled, true);
  assert.equal(second.res.headers["x-cache"], "MISS");
  assert.deepEqual(second.res.body, { ok: true });
});

test("cacheMiddleware remove entradas expiradas antes de consultar o cache", async () => {
  const middleware = createCacheMiddleware({ ttlMs: 1 });
  const req = buildReq();

  await runCached({ req, body: { items: [1] }, middleware });

  await new Promise((resolve) => setTimeout(resolve, 5));

  const second = await runCached({ req, body: { items: [2] }, middleware });

  assert.equal(second.handlerCalled, true);
  assert.equal(second.res.headers["x-cache"], "MISS");
  assert.deepEqual(second.res.body, { items: [2] });
});

test("cacheMiddleware respeita limite maximo de entradas e descarta a mais antiga", async () => {
  process.env.CACHE_MAX_ENTRIES = "2";
  const middleware = createCacheMiddleware({ ttlMs: 1000 });

  await runCached({ req: buildReq({ originalUrl: "/maquinas?pagina=1" }), body: { page: 1 }, middleware });
  await runCached({ req: buildReq({ originalUrl: "/maquinas?pagina=2" }), body: { page: 2 }, middleware });
  await runCached({ req: buildReq({ originalUrl: "/maquinas?pagina=3" }), body: { page: 3 }, middleware });

  const firstAgain = await runCached({
    req: buildReq({ originalUrl: "/maquinas?pagina=1" }),
    body: { page: "reloaded" },
    middleware
  });
  const latest = await runCached({
    req: buildReq({ originalUrl: "/maquinas?pagina=3" }),
    body: { page: "ignored" },
    middleware
  });

  assert.equal(firstAgain.handlerCalled, true);
  assert.equal(firstAgain.res.headers["x-cache"], "MISS");
  assert.deepEqual(firstAgain.res.body, { page: "reloaded" });
  assert.equal(latest.handlerCalled, false);
  assert.equal(latest.res.headers["x-cache"], "HIT");
  assert.deepEqual(latest.res.body, { page: 3 });
});
