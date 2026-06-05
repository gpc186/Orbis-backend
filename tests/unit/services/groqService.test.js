const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");

const GroqService = require("../../../src/services/groqService");

const originals = {
  getClient: GroqService.getClient,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  GROQ_MODEL: process.env.GROQ_MODEL,
  GROQ_EMBEDDING_MODEL: process.env.GROQ_EMBEDDING_MODEL
};

function configureEnv() {
  process.env.GROQ_API_KEY = "groq-key";
  process.env.GROQ_MODEL = "llama-test";
  process.env.GROQ_EMBEDDING_MODEL = "embed-test";
}

function restoreEnv() {
  for (const key of ["GROQ_API_KEY", "GROQ_MODEL", "GROQ_EMBEDDING_MODEL"]) {
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

function validMessages() {
  return [{ role: "user", content: "Como esta o sistema?" }];
}

function validTools() {
  return [
    {
      type: "function",
      function: {
        name: "buscar_contexto",
        description: "Busca contexto operacional.",
        parameters: { type: "object", properties: {} }
      }
    }
  ];
}

afterEach(() => {
  GroqService.getClient = originals.getClient;
  restoreEnv();
});

test("getConfig aplica defaults e exige chave de API", () => {
  delete process.env.GROQ_API_KEY;
  delete process.env.GROQ_MODEL;
  delete process.env.GROQ_EMBEDDING_MODEL;

  assert.throws(() => GroqService.getConfig(), assertAppError(500));

  process.env.GROQ_API_KEY = "groq-key";
  assert.deepEqual(GroqService.getConfig(), {
    apiKey: "groq-key",
    model: "llama-3.3-70b-versatile",
    embeddingModel: "nomic-embed-text-v1_5"
  });
});

test("validateMessages e validateTools aceitam formatos validos e bloqueiam invalidos", () => {
  assert.doesNotThrow(() => GroqService.validateMessages(validMessages()));
  assert.doesNotThrow(() => GroqService.validateMessages([{ role: "assistant", tool_calls: [{ id: "1" }] }]));
  assert.doesNotThrow(() => GroqService.validateMessages([{ role: "tool", tool_call_id: "call-1", content: "{}" }]));
  assert.doesNotThrow(() => GroqService.validateTools(validTools()));

  assert.throws(() => GroqService.validateMessages([]), assertAppError(400));
  assert.throws(() => GroqService.validateMessages([{ role: "admin", content: "x" }]), assertAppError(400));
  assert.throws(() => GroqService.validateMessages([{ role: "assistant", content: "" }]), assertAppError(400));
  assert.throws(() => GroqService.validateMessages([{ role: "tool", content: "{}" }]), assertAppError(400));
  assert.throws(() => GroqService.validateTools([{ type: "function", function: { name: "" } }]), assertAppError(400));
});

test("generateText envia mensagens ao modelo configurado e retorna texto trimado", async () => {
  configureEnv();
  let createPayload;
  GroqService.getClient = () => ({
    chat: {
      completions: {
        async create(payload) {
          createPayload = payload;
          return { choices: [{ message: { content: "  Resposta final  " } }] };
        }
      }
    }
  });

  const result = await GroqService.generateText({ messages: validMessages(), temperature: 0.4 });

  assert.equal(result, "Resposta final");
  assert.deepEqual(createPayload, {
    model: "llama-test",
    temperature: 0.4,
    messages: validMessages()
  });
});

test("generateWithTools retorna mensagem com tool call e trata limite 429", async () => {
  configureEnv();
  let createPayload;
  GroqService.getClient = () => ({
    chat: {
      completions: {
        async create(payload) {
          createPayload = payload;
          return { choices: [{ message: { tool_calls: [{ id: "call-1" }] } }] };
        }
      }
    }
  });

  const result = await GroqService.generateWithTools({
    messages: validMessages(),
    tools: validTools(),
    temperature: 0.1
  });

  assert.deepEqual(result, { tool_calls: [{ id: "call-1" }] });
  assert.deepEqual(createPayload, {
    model: "llama-test",
    temperature: 0.1,
    messages: validMessages(),
    tools: validTools(),
    tool_choice: "auto"
  });

  GroqService.getClient = () => ({
    chat: {
      completions: {
        async create() {
          const error = new Error("rate");
          error.status = 429;
          throw error;
        }
      }
    }
  });

  await assert.rejects(
    () => GroqService.generateWithTools({ messages: validMessages(), tools: validTools() }),
    assertAppError(429)
  );
});

test("generateText bloqueia resposta vazia e erro inesperado como 502", async () => {
  configureEnv();
  GroqService.getClient = () => ({
    chat: {
      completions: {
        async create() {
          return { choices: [{ message: { content: "   " } }] };
        }
      }
    }
  });

  await assert.rejects(
    () => GroqService.generateText({ messages: validMessages() }),
    assertAppError(502)
  );

  GroqService.getClient = () => ({
    chat: {
      completions: {
        async create() {
          throw new Error("rede fora");
        }
      }
    }
  });

  await assert.rejects(
    () => GroqService.generateText({ messages: validMessages() }),
    assertAppError(502)
  );
});

test("generateEmbeddings normaliza input, ordena resposta e valida tamanho", async () => {
  configureEnv();
  let embeddingPayload;
  GroqService.getClient = () => ({
    embeddings: {
      async create(payload) {
        embeddingPayload = payload;
        return {
          data: [
            { index: 1, embedding: [0.2, 0.3] },
            { index: 0, embedding: [0.1, 0.2] }
          ]
        };
      }
    }
  });

  const result = await GroqService.generateEmbeddings({ input: [" motor ", "", "sensor"], type: "query" });

  assert.deepEqual(result, [[0.1, 0.2], [0.2, 0.3]]);
  assert.deepEqual(embeddingPayload, {
    model: "embed-test",
    input: ["search_query: motor", "search_query: sensor"],
    encoding_format: "float"
  });

  await assert.rejects(() => GroqService.generateEmbeddings({ input: "   " }), assertAppError(400));

  GroqService.getClient = () => ({
    embeddings: {
      async create() {
        return { data: [{ index: 0, embedding: [0.1] }] };
      }
    }
  });

  await assert.rejects(
    () => GroqService.generateEmbeddings({ input: ["a", "b"] }),
    assertAppError(502)
  );
});
