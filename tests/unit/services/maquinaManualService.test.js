const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");

const MaquinaManualService = require("../../../src/services/maquinaManualService");
const EmbeddingService = require("../../../src/services/embeddingService");
const GroqService = require("../../../src/services/groqService");
const StorageService = require("../../../src/services/storageService");

const originals = {
  extractText: MaquinaManualService.extractText,
  extractSpecs: MaquinaManualService.extractSpecs,
  analyzeManual: MaquinaManualService.analyzeManual,
  generateEmbeddings: EmbeddingService.generateEmbeddings,
  getModelLabel: EmbeddingService.getModelLabel,
  groqGetConfig: GroqService.getConfig,
  generateText: GroqService.generateText,
  uploadArquivo: StorageService.uploadArquivo,
  dateNow: Date.now
};

function assertAppError(statusCode) {
  return (error) => error.name === "AppError" && error.statusCode === statusCode;
}

function createPdfFile(overrides = {}) {
  return {
    originalname: "Manual T\u00e9cnico.pdf",
    mimetype: "application/pdf",
    size: 1234,
    buffer: Buffer.from("pdf"),
    ...overrides
  };
}

afterEach(() => {
  MaquinaManualService.extractText = originals.extractText;
  MaquinaManualService.extractSpecs = originals.extractSpecs;
  MaquinaManualService.analyzeManual = originals.analyzeManual;
  EmbeddingService.generateEmbeddings = originals.generateEmbeddings;
  EmbeddingService.getModelLabel = originals.getModelLabel;
  GroqService.getConfig = originals.groqGetConfig;
  GroqService.generateText = originals.generateText;
  StorageService.uploadArquivo = originals.uploadArquivo;
  Date.now = originals.dateNow;
});

test("chunkText, keywordScore, cosineSimilarity e averageEmbedding cobrem regras puras", () => {
  const chunks = MaquinaManualService.chunkText(" trecho inicial ".repeat(400));

  assert.ok(chunks.length > 1);
  assert.equal(chunks[0].index, 0);
  assert.equal(chunks[0].text.startsWith("trecho inicial"), true);

  assert.ok(MaquinaManualService.keywordScore("maximum temperature limit temperature", ["temperature", "maximum"]) > 0);
  assert.equal(MaquinaManualService.keywordScore("", ["temperature"]), 0);
  assert.equal(MaquinaManualService.cosineSimilarity([1, 0], [1, 0]), 1);
  assert.equal(MaquinaManualService.cosineSimilarity([1, 0], [0, 1]), 0);
  assert.equal(MaquinaManualService.cosineSimilarity([1], [1, 0]), 0);
  assert.deepEqual(MaquinaManualService.averageEmbedding([[1, 3], [3, 5]]), [2, 4]);
  assert.equal(MaquinaManualService.averageEmbedding([]), null);
});

test("selectChunksForEmbedding prioriza inicio e chunks com palavras-chave", () => {
  const chunks = Array.from({ length: 90 }, (_, index) => ({
    index,
    text: index === 70
      ? "maximum temperature limit and vibration velocity mm/s RMS"
      : `chunk ${index}`
  }));

  const selected = MaquinaManualService.selectChunksForEmbedding(chunks);

  assert.equal(selected.length, 80);
  assert.equal(selected.some((chunk) => chunk.index === 0), true);
  assert.equal(selected.some((chunk) => chunk.index === 70), true);
  assert.deepEqual(
    selected.map((chunk) => chunk.index),
    selected.map((chunk) => chunk.index).toSorted((a, b) => a - b)
  );
});

test("selectRelevantChunks combina similaridade semantica e palavras-chave", () => {
  const chunks = [
    { index: 0, text: "manual overview", embedding: [0, 1] },
    { index: 1, text: "maximum temperature 80 celsius", embedding: [0.1, 0.9] },
    { index: 2, text: "maximum vibration velocity 4 mm/s RMS", embedding: [0.2, 0.8] },
    { index: 3, text: "lubrication notes", embedding: [1, 0] }
  ];

  const selected = MaquinaManualService.selectRelevantChunks(chunks, [1, 0], 3);

  assert.deepEqual(selected.map((chunk) => chunk.index), [1, 2, 3]);
  assert.ok(selected.every((chunk) => typeof chunk.score === "number"));
});

test("parseJson aceita JSON puro ou extraido de texto e bloqueia payload invalido", () => {
  assert.deepEqual(MaquinaManualService.parseJson('{"temperaturaMaxima":80}'), { temperaturaMaxima: 80 });
  assert.deepEqual(
    MaquinaManualService.parseJson('Resposta:\n{"vibracaoMaxima":4}\nFim'),
    { vibracaoMaxima: 4 }
  );
  assert.throws(() => MaquinaManualService.parseJson("sem json"), assertAppError(502));
});

test("safeFilename remove acentos, caracteres inseguros e adiciona timestamp", () => {
  Date.now = () => 1780590000000;

  assert.equal(
    MaquinaManualService.safeFilename("Manual T\u00e9cnico @ Linha 1.pdf"),
    "1780590000000-Manual-Tecnico-Linha-1.pdf"
  );
  assert.equal(MaquinaManualService.safeFilename("!!!"), "1780590000000-manual.pdf");
});

test("analyzeManual valida arquivo, gera embeddings e extrai specs com chunks relevantes", async () => {
  const embeddingCalls = [];
  let specsPayload;

  MaquinaManualService.extractText = async () => [
    "maximum temperature 80 celsius for operating temperature",
    "maximum vibration velocity 4 mm/s RMS",
    "general maintenance instructions"
  ].join("\n\n");
  EmbeddingService.generateEmbeddings = async ({ input, type }) => {
    embeddingCalls.push({ input, type });

    if (type === "query") {
      return [[1, 0]];
    }

    return input.map((_, index) => (index === 0 ? [1, 0] : [0.5, 0.5]));
  };
  MaquinaManualService.extractSpecs = async (payload) => {
    specsPayload = payload;
    return {
      temperaturaMaxima: 80,
      vibracaoMaxima: 4,
      confianca: "alta"
    };
  };

  const result = await MaquinaManualService.analyzeManual({
    file: createPdfFile(),
    maquina: { id: 7, nome: "Motor" }
  });

  assert.equal(embeddingCalls.length, 2);
  assert.equal(embeddingCalls[0].type, "document");
  assert.equal(embeddingCalls[1].type, "query");
  assert.deepEqual(specsPayload.maquina, { id: 7, nome: "Motor" });
  assert.ok(specsPayload.trechos.some((trecho) => trecho.includes("temperature")));
  assert.equal(result.chunksComEmbedding.length, result.chunkEmbeddings.length);
  assert.deepEqual(result.especificacoes, {
    temperaturaMaxima: 80,
    vibracaoMaxima: 4,
    confianca: "alta"
  });

  await assert.rejects(() => MaquinaManualService.analyzeManual({ file: null }), assertAppError(400));
  await assert.rejects(
    () => MaquinaManualService.analyzeManual({ file: createPdfFile({ mimetype: "text/plain" }) }),
    assertAppError(400)
  );
});

test("analyzeManual falha quando texto nao gera chunks", async () => {
  MaquinaManualService.extractText = async () => "";

  await assert.rejects(
    () => MaquinaManualService.analyzeManual({ file: createPdfFile() }),
    assertAppError(400)
  );
});

test("previewSpecs retorna metadata publica e modelos usados", async () => {
  MaquinaManualService.analyzeManual = async () => ({
    especificacoes: { temperaturaMaxima: 80, confianca: "media" }
  });
  EmbeddingService.getModelLabel = () => "gemini:embedding";
  GroqService.getConfig = () => ({ model: "llama-test" });

  const result = await MaquinaManualService.previewSpecs({
    file: createPdfFile({ originalname: "manual.pdf", size: 456 }),
    maquina: { id: 1 }
  });

  assert.deepEqual(result, {
    nomeArquivo: "manual.pdf",
    mimeType: "application/pdf",
    tamanhoBytes: 456,
    especificacoes: { temperaturaMaxima: 80, confianca: "media" },
    modeloEmbedding: "gemini:embedding",
    modeloAnalise: "llama-test"
  });
});

test("buildManualData faz upload, resume embeddings e preserva chunks/especificacoes", async () => {
  Date.now = () => 1780590000000;
  MaquinaManualService.analyzeManual = async () => ({
    textoExtraido: "texto extraido do manual",
    chunkEmbeddings: [[1, 3], [3, 5]],
    chunksComEmbedding: [
      { index: 0, text: "maximum temperature", embedding: [1, 3] },
      { index: 1, text: "maximum vibration", embedding: [3, 5] }
    ],
    especificacoes: { temperaturaMaxima: 80 }
  });
  StorageService.uploadArquivo = async (payload) => ({
    caminho: payload.caminho,
    url: `https://cdn.example.com/${payload.caminho}`
  });
  EmbeddingService.getModelLabel = () => "groq:embed";
  GroqService.getConfig = () => ({ model: "llama-test" });

  const file = createPdfFile({ originalname: "Manual T\u00e9cnico.pdf", size: 789 });
  const result = await MaquinaManualService.buildManualData({
    file,
    maquina: { id: 10 },
    caminhoPrefixo: "maquinas/10/manual"
  });

  assert.equal(result.nomeArquivo, "Manual T\u00e9cnico.pdf");
  assert.equal(result.mimeType, "application/pdf");
  assert.equal(result.tamanhoBytes, 789);
  assert.equal(result.caminho, "maquinas/10/manual/1780590000000-Manual-Tecnico.pdf");
  assert.equal(result.url, "https://cdn.example.com/maquinas/10/manual/1780590000000-Manual-Tecnico.pdf");
  assert.equal(result.textoExtraido, "texto extraido do manual");
  assert.deepEqual(result.embedding, [2, 4]);
  assert.equal(result.chunks.length, 2);
  assert.deepEqual(result.especificacoes, { temperaturaMaxima: 80 });
  assert.equal(result.modeloEmbedding, "groq:embed");
  assert.equal(result.modeloAnalise, "llama-test");

  assert.equal(await MaquinaManualService.buildManualData({ file: null }), null);
});

test("extractSpecs monta prompt com maquina e trechos e faz parse do JSON retornado pela IA", async () => {
  let payloadRecebido;
  GroqService.generateText = async (payload) => {
    payloadRecebido = payload;
    return '```json\n{"temperaturaMaxima":80,"confianca":"alta"}\n```';
  };

  const result = await MaquinaManualService.extractSpecs({
    maquina: { id: 3, nome: "Motor" },
    trechos: ["maximum temperature 80 celsius"]
  });

  assert.equal(payloadRecebido.temperature, 0);
  assert.equal(payloadRecebido.messages[0].role, "system");
  assert.match(payloadRecebido.messages[1].content, /Motor/);
  assert.match(payloadRecebido.messages[1].content, /TRECHO 1/);
  assert.deepEqual(result, { temperaturaMaxima: 80, confianca: "alta" });
});
