const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");

const EmbeddingService = require("../../../src/services/embeddingService");
const GroqService = require("../../../src/services/groqService");

const originals = {
  fetch: global.fetch,
  generateGroqEmbeddings: GroqService.generateEmbeddings,
  requestGeminiBatchEmbeddings: EmbeddingService.requestGeminiBatchEmbeddings,
  EMBEDDING_PROVIDER: process.env.EMBEDDING_PROVIDER,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_EMBEDDING_MODEL: process.env.GEMINI_EMBEDDING_MODEL,
  GEMINI_EMBEDDING_BATCH_SIZE: process.env.GEMINI_EMBEDDING_BATCH_SIZE,
  GEMINI_EMBEDDING_DIMENSIONS: process.env.GEMINI_EMBEDDING_DIMENSIONS,
  GROQ_EMBEDDING_MODEL: process.env.GROQ_EMBEDDING_MODEL
};

function restoreEnv() {
  for (const key of [
    "EMBEDDING_PROVIDER",
    "GEMINI_API_KEY",
    "GEMINI_EMBEDDING_MODEL",
    "GEMINI_EMBEDDING_BATCH_SIZE",
    "GEMINI_EMBEDDING_DIMENSIONS",
    "GROQ_EMBEDDING_MODEL"
  ]) {
    if (originals[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originals[key];
    }
  }
}

function assertAppError(statusCode) {
  return (error) => error.name === "AppError" && error.statusCode === statusCode;
}

afterEach(() => {
  global.fetch = originals.fetch;
  GroqService.generateEmbeddings = originals.generateGroqEmbeddings;
  EmbeddingService.requestGeminiBatchEmbeddings = originals.requestGeminiBatchEmbeddings;
  restoreEnv();
});

test("getConfig escolhe provider e getModelLabel reflete modelo ativo", () => {
  delete process.env.EMBEDDING_PROVIDER;
  delete process.env.GEMINI_API_KEY;
  process.env.GROQ_EMBEDDING_MODEL = "groq-embed";

  assert.equal(EmbeddingService.getConfig().provider, "groq");
  assert.equal(EmbeddingService.getModelLabel(), "groq:groq-embed");

  process.env.GEMINI_API_KEY = "gemini-key";
  process.env.GEMINI_EMBEDDING_MODEL = "gemini-custom";
  assert.equal(EmbeddingService.getConfig().provider, "gemini");
  assert.equal(EmbeddingService.getModelLabel(), "gemini:gemini-custom");
});

test("generateEmbeddings delega para Groq quando provider e groq", async () => {
  process.env.EMBEDDING_PROVIDER = "groq";
  let payloadRecebido;
  GroqService.generateEmbeddings = async (payload) => {
    payloadRecebido = payload;
    return [[0.1, 0.2]];
  };

  const result = await EmbeddingService.generateEmbeddings({ input: "sensor", type: "query" });

  assert.deepEqual(payloadRecebido, { input: "sensor", type: "query" });
  assert.deepEqual(result, [[0.1, 0.2]]);
});

test("generateEmbeddings bloqueia provider invalido", async () => {
  process.env.EMBEDDING_PROVIDER = "outro";

  await assert.rejects(
    () => EmbeddingService.generateEmbeddings({ input: "sensor" }),
    assertAppError(500)
  );
});

test("generateGeminiEmbeddings faz batches, normaliza input e envia payload esperado", async () => {
  const fetchCalls = [];
  global.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    fetchCalls.push({ url, options: { ...options, body } });
    return {
      ok: true,
      async json() {
        return {
          embeddings: body.requests.map((_, index) => ({ values: [index + fetchCalls.length] }))
        };
      }
    };
  };

  const result = await EmbeddingService.generateGeminiEmbeddings({
    input: [" motor ", "", "sensor", "bomba"],
    type: "query",
    config: {
      geminiApiKey: "gemini-key",
      geminiModel: "gemini-embedding-001",
      geminiBatchSize: 2,
      geminiOutputDimensionality: 128
    }
  });

  assert.deepEqual(result, [[1], [2], [2]]);
  assert.equal(fetchCalls.length, 2);
  assert.equal(fetchCalls[0].url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents");
  assert.equal(fetchCalls[0].options.method, "POST");
  assert.equal(fetchCalls[0].options.headers["x-goog-api-key"], "gemini-key");
  assert.deepEqual(fetchCalls[0].options.body.requests[0], {
    model: "models/gemini-embedding-001",
    content: { parts: [{ text: "motor" }] },
    taskType: "RETRIEVAL_QUERY",
    outputDimensionality: 128
  });
});

test("generateGeminiEmbeddings valida texto, chave e tamanho da resposta", async () => {
  await assert.rejects(
    () => EmbeddingService.generateGeminiEmbeddings({
      input: " ",
      type: "document",
      config: { geminiApiKey: "key", geminiModel: "gemini-embedding-001" }
    }),
    assertAppError(400)
  );

  await assert.rejects(
    () => EmbeddingService.generateGeminiEmbeddings({
      input: "sensor",
      type: "document",
      config: { geminiApiKey: null, geminiModel: "gemini-embedding-001" }
    }),
    assertAppError(500)
  );

  EmbeddingService.requestGeminiBatchEmbeddings = async () => [];
  await assert.rejects(
    () => EmbeddingService.generateGeminiEmbeddings({
      input: ["sensor"],
      type: "document",
      config: { geminiApiKey: "key", geminiModel: "gemini-embedding-001", geminiBatchSize: 10 }
    }),
    assertAppError(502)
  );
});

test("requestGeminiBatchEmbeddings mapeia erro HTTP e prefixa modelo antigo", async () => {
  let payload;
  global.fetch = async (url, options) => {
    payload = { url, body: JSON.parse(options.body) };
    return {
      ok: true,
      async json() {
        return { embeddings: [{ values: [0.5, 0.6] }] };
      }
    };
  };

  const result = await EmbeddingService.requestGeminiBatchEmbeddings({
    batch: ["manual tecnico"],
    type: "document",
    config: {
      geminiApiKey: "gemini-key",
      geminiModel: "text-embedding-004",
      geminiOutputDimensionality: null
    }
  });

  assert.deepEqual(result, [[0.5, 0.6]]);
  assert.equal(payload.url, "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents");
  assert.match(
    payload.body.requests[0].content.parts[0].text,
    /^Represent this technical manual passage for retrieval:\nmanual tecnico$/
  );

  global.fetch = async () => ({
    ok: false,
    status: 429,
    async json() {
      return { error: "rate" };
    }
  });

  await assert.rejects(
    () => EmbeddingService.requestGeminiBatchEmbeddings({
      batch: ["sensor"],
      type: "query",
      config: { geminiApiKey: "gemini-key", geminiModel: "gemini-embedding-001" }
    }),
    assertAppError(429)
  );
});

test("helpers de Gemini normalizam modelo, dimensao e prefixo", () => {
  assert.equal(EmbeddingService.normalizeGeminiModel("gemini-embedding-001"), "models/gemini-embedding-001");
  assert.equal(EmbeddingService.normalizeGeminiModel("models/custom"), "models/custom");
  assert.equal(EmbeddingService.parseOutputDimensionality("128"), 128);
  assert.equal(EmbeddingService.parseOutputDimensionality("0"), null);
  assert.match(
    EmbeddingService.prefixGeminiEmbedding2Text({ text: "falha", type: "query" }),
    /^Represent this search query/
  );
});
