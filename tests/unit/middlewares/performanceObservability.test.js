const EventEmitter = require("node:events");
const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");

const logger = require("../../../src/utils/logger");
const requestContextMiddleware = require("../../../src/middlewares/requestContextMiddleware");
const { runQueryWithTiming } = require("../../../src/utils/prismaQueryTiming");
const { runWithRequestContext } = require("../../../src/utils/requestContextStorage");

const originals = {
  loggerInfo: logger.info,
  loggerWarn: logger.warn,
  requestSlowMs: process.env.REQUEST_SLOW_MS,
  prismaSlowQueryMs: process.env.PRISMA_SLOW_QUERY_MS
};

afterEach(() => {
  logger.info = originals.loggerInfo;
  logger.warn = originals.loggerWarn;

  if (originals.requestSlowMs === undefined) {
    delete process.env.REQUEST_SLOW_MS;
  } else {
    process.env.REQUEST_SLOW_MS = originals.requestSlowMs;
  }

  if (originals.prismaSlowQueryMs === undefined) {
    delete process.env.PRISMA_SLOW_QUERY_MS;
  } else {
    process.env.PRISMA_SLOW_QUERY_MS = originals.prismaSlowQueryMs;
  }
});

function buildReq() {
  return {
    method: "GET",
    originalUrl: "/dashboard/resumo",
    path: "/dashboard/resumo",
    ip: "127.0.0.1",
    get(name) {
      return name === "user-agent" ? "test-agent" : null;
    }
  };
}

function buildRes() {
  const res = new EventEmitter();
  res.statusCode = 200;
  res.locals = {};
  res.headers = {};
  res.setHeader = (name, value) => {
    res.headers[name.toLowerCase()] = value;
  };
  return res;
}

test("requestContextMiddleware registra request_slow acima do threshold", async () => {
  const logs = [];
  process.env.REQUEST_SLOW_MS = "0";
  logger.info = () => {};
  logger.warn = (message, context) => logs.push({ message, context });

  const req = buildReq();
  const res = buildRes();

  await new Promise((resolve) => {
    requestContextMiddleware(req, res, resolve);
  });
  res.emit("finish");

  const slow = logs.find((entry) => entry.message === "request_slow");
  assert.equal(typeof req.requestId, "string");
  assert.equal(res.headers["x-request-id"], req.requestId);
  assert.equal(slow.context.requestId, req.requestId);
  assert.equal(slow.context.path, "/dashboard/resumo");
});

test("prisma slow query log inclui requestId e nao inclui args sensiveis", async () => {
  const logs = [];
  process.env.PRISMA_SLOW_QUERY_MS = "0";
  logger.warn = (message, context) => logs.push({ message, context });

  await runWithRequestContext({ requestId: "req-test" }, async () => {
    await runQueryWithTiming({
      model: "Usuario",
      operation: "findMany",
      args: { where: { senha: "segredo" } },
      query: async () => [{ id: 1 }]
    });
  });

  const slow = logs.find((entry) => entry.message === "prisma_query_slow");
  assert.equal(slow.context.requestId, "req-test");
  assert.equal(slow.context.model, "Usuario");
  assert.equal(slow.context.operation, "findMany");
  assert.equal(typeof slow.context.durationMs, "number");
  assert.equal(Object.prototype.hasOwnProperty.call(slow.context, "args"), false);
  assert.equal(JSON.stringify(slow.context).includes("segredo"), false);
});
