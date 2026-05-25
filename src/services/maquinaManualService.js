const { PDFParse } = require("pdf-parse");
const AppError = require("../utils/appErrorUtils");
const EmbeddingService = require("./embeddingService");
const GroqService = require("./groqService");
const StorageService = require("./storageService");

const MANUAL_BUCKET = "machine-manuals";
const MAX_TEXT_CHARS = Number(process.env.MANUAL_MAX_TEXT_CHARS || 100000);
const CHUNK_SIZE = Number(process.env.MANUAL_CHUNK_SIZE || 1800);
const CHUNK_OVERLAP = Number(process.env.MANUAL_CHUNK_OVERLAP || 250);
const MAX_CHUNKS_TO_EMBED = Number(process.env.MANUAL_MAX_CHUNKS || 80);
const ANALYSIS_CHUNKS = Number(process.env.MANUAL_ANALYSIS_CHUNKS || 14);

const TEMPERATURE_KEYWORDS = [
  "ambient temperature",
  "operating temperature",
  "surface temperature",
  "maximum temperature",
  "temperature",
  "temperatura",
  "celsius",
  "deg c",
  "°c",
  "ºc"
];

const VIBRATION_KEYWORDS = [
  "maximum vibration",
  "vibration velocity",
  "vibration level",
  "vibration",
  "vibracao",
  "vibração",
  "mm/s",
  "rms",
  "m/s2",
  "m/s²",
  "bearing vibration"
];

const LIMIT_KEYWORDS = [
  "maximum",
  "max.",
  "max ",
  "limit",
  "permitted",
  "allowed",
  "shall not",
  "must not",
  "not exceed",
  "not greater",
  "nao deve",
  "não deve",
  "limite"
];

class MaquinaManualService {
  static async analyzeManual({ file, maquina = null }) {
    if (!file) {
      throw new AppError("Manual nao enviado!", 400);
    }

    if (file.mimetype !== "application/pdf") {
      throw new AppError("Manual invalido. Envie um arquivo PDF.", 400);
    }

    const textoExtraido = await this.extractText(file.buffer);
    const chunks = this.selectChunksForEmbedding(this.chunkText(textoExtraido));

    if (chunks.length === 0) {
      throw new AppError("Nao foi possivel extrair texto do manual enviado.", 400);
    }

    const chunkTexts = chunks.map((chunk) => chunk.text);
    const chunkEmbeddings = await EmbeddingService.generateEmbeddings({
      input: chunkTexts,
      type: "document"
    });
    const queryEmbedding = (await EmbeddingService.generateEmbeddings({
      input: "temperatura ideal, temperatura maxima, temperatura ambiente maxima, operating temperature, maximum temperature, vibracao ideal, vibracao maxima, maximum vibration, vibration velocity, mm/s RMS, limites operacionais, especificacoes tecnicas da maquina",
      type: "query"
    }))[0];

    const chunksComEmbedding = chunks.map((chunk, index) => ({
      ...chunk,
      embedding: chunkEmbeddings[index]
    }));

    const relevantes = this.selectRelevantChunks(chunksComEmbedding, queryEmbedding, ANALYSIS_CHUNKS);
    const especificacoes = await this.extractSpecs({
      maquina,
      trechos: relevantes.map((chunk) => chunk.text)
    });

    return {
      textoExtraido,
      chunkEmbeddings,
      chunksComEmbedding,
      especificacoes
    };
  }

  static async previewSpecs({ file, maquina = null }) {
    const analysis = await this.analyzeManual({ file, maquina });

    return {
      nomeArquivo: file.originalname || "manual.pdf",
      mimeType: file.mimetype,
      tamanhoBytes: file.size,
      especificacoes: analysis.especificacoes,
      modeloEmbedding: EmbeddingService.getModelLabel(),
      modeloAnalise: GroqService.getConfig().model
    };
  }

  static async buildManualData({ file, maquina, caminhoPrefixo }) {
    if (!file) return null;
    const analysis = await this.analyzeManual({ file, maquina });

    const caminho = `${caminhoPrefixo}/${this.safeFilename(file.originalname || "manual.pdf")}`;
    const upload = await StorageService.uploadArquivo({
      bucket: MANUAL_BUCKET,
      caminho,
      buffer: file.buffer,
      contentType: file.mimetype
    });

    return {
      nomeArquivo: file.originalname || "manual.pdf",
      mimeType: file.mimetype,
      tamanhoBytes: file.size,
      url: upload.url,
      caminho: upload.caminho,
      textoExtraido: analysis.textoExtraido.slice(0, MAX_TEXT_CHARS),
      embedding: this.averageEmbedding(analysis.chunkEmbeddings),
      chunks: analysis.chunksComEmbedding,
      especificacoes: analysis.especificacoes,
      modeloEmbedding: EmbeddingService.getModelLabel(),
      modeloAnalise: GroqService.getConfig().model
    };
  }

  static async extractText(buffer) {
    let parser = null;

    try {
      parser = new PDFParse({ data: new Uint8Array(buffer) });
      const result = await parser.getText({
        pageJoiner: "\n\n",
        lineEnforce: true
      });
      const text = String(result?.text || "")
        .replace(/\u0000/g, "")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{4,}/g, "\n\n\n")
        .trim();

      if (text.length < 20) {
        throw new AppError("O manual nao possui texto suficiente para analise.", 400);
      }

      return text.slice(0, MAX_TEXT_CHARS);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Nao foi possivel ler o PDF do manual.", 400);
    } finally {
      if (parser) await parser.destroy().catch(() => {});
    }
  }

  static chunkText(text) {
    const normalized = String(text || "").trim();
    const chunks = [];
    let start = 0;

    while (start < normalized.length) {
      const end = Math.min(start + CHUNK_SIZE, normalized.length);
      const slice = normalized.slice(start, end).trim();

      if (slice.length > 0) {
        chunks.push({ index: chunks.length, text: slice });
      }

      if (end >= normalized.length) break;
      start = Math.max(0, end - CHUNK_OVERLAP);
    }

    return chunks;
  }

  static selectChunksForEmbedding(chunks) {
    if (chunks.length <= MAX_CHUNKS_TO_EMBED) return chunks;

    const selected = new Map();
    const addChunk = (chunk) => selected.set(chunk.index, chunk);
    const addTopByKeywords = (keywords, count) => {
      chunks
        .map((chunk) => ({
          ...chunk,
          keywordScore: this.keywordScore(chunk.text, keywords)
        }))
        .filter((chunk) => chunk.keywordScore > 0)
        .sort((a, b) => b.keywordScore - a.keywordScore)
        .slice(0, count)
        .forEach(addChunk);
    };

    chunks.slice(0, Math.min(20, MAX_CHUNKS_TO_EMBED)).forEach(addChunk);
    addTopByKeywords(TEMPERATURE_KEYWORDS, 20);
    addTopByKeywords(VIBRATION_KEYWORDS, 20);
    addTopByKeywords([...TEMPERATURE_KEYWORDS, ...VIBRATION_KEYWORDS, ...LIMIT_KEYWORDS], 20);

    for (const chunk of chunks) {
      if (selected.size >= MAX_CHUNKS_TO_EMBED) break;
      addChunk(chunk);
    }

    return Array.from(selected.values()).sort((a, b) => a.index - b.index);
  }

  static selectRelevantChunks(chunks, queryEmbedding, limit) {
    const scored = chunks
      .map((chunk) => {
        const semanticScore = this.cosineSimilarity(chunk.embedding, queryEmbedding);
        const keywordScore = this.keywordScore(chunk.text, [
          ...TEMPERATURE_KEYWORDS,
          ...VIBRATION_KEYWORDS,
          ...LIMIT_KEYWORDS
        ]);

        return {
          ...chunk,
          semanticScore,
          keywordScore,
          score: semanticScore + keywordScore
        };
      })
      .sort((a, b) => b.score - a.score);

    const selected = new Map();
    const addTop = (predicate, count) => {
      scored
        .filter(predicate)
        .slice(0, count)
        .forEach((chunk) => selected.set(chunk.index, chunk));
    };

    addTop((chunk) => this.keywordScore(chunk.text, TEMPERATURE_KEYWORDS) > 0, 4);
    addTop((chunk) => this.keywordScore(chunk.text, VIBRATION_KEYWORDS) > 0, 4);

    for (const chunk of scored) {
      if (selected.size >= limit) break;
      selected.set(chunk.index, chunk);
    }

    return Array.from(selected.values())
      .sort((a, b) => a.index - b.index)
      .slice(0, limit);
  }

  static keywordScore(text, keywords) {
    const normalized = String(text || "").toLowerCase();
    let score = 0;

    for (const keyword of keywords) {
      const escaped = String(keyword).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const matches = normalized.match(new RegExp(escaped, "g"));
      if (matches) {
        score += matches.length * (keyword.includes(" ") ? 0.35 : 0.2);
      }
    }

    return score;
  }

  static cosineSimilarity(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0;

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i += 1) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  static averageEmbedding(embeddings) {
    if (!Array.isArray(embeddings) || embeddings.length === 0) return null;

    const size = embeddings[0].length;
    const average = new Array(size).fill(0);

    for (const embedding of embeddings) {
      for (let i = 0; i < size; i += 1) {
        average[i] += embedding[i] || 0;
      }
    }

    return average.map((value) => value / embeddings.length);
  }

  static async extractSpecs({ maquina, trechos }) {
    const prompt = `
Analise os trechos do manual tecnico e extraia somente especificacoes operacionais da maquina.
Responda exclusivamente com JSON valido, sem markdown.

Schema:
{
  "temperaturaIdeal": number|null,
  "temperaturaMaxima": number|null,
  "vibracaoIdeal": number|null,
  "vibracaoMaxima": number|null,
  "unidadeTemperatura": "C"|"F"|null,
  "unidadeVibracao": string|null,
  "outrasSpecs": [{"nome": string, "valor": string, "unidade": string|null}],
  "confianca": "baixa"|"media"|"alta",
  "observacoes": string[]
}

Regras:
- Use null quando o manual nao trouxer limite claro nem base tecnica suficiente para estimar.
- Nao invente limites maximos; limites maximos devem vir do manual.
- Se houver faixa ideal, use o maior valor seguro da faixa como ideal.
- Procure especificamente por temperature, ambient temperature, operating temperature, vibration, vibration velocity, RMS e mm/s.
- temperaturaMaxima deve ser a maxima temperatura ambiente/operacional permitida. Nao use temperatura de superficie como temperaturaMaxima; coloque temperatura de superficie em outrasSpecs.
- Prefira Celsius quando o manual trouxer Celsius.
- Vibracao pode aparecer como mm/s, m/s2, g, Hz ou outra unidade; preserve a unidade.
- Se encontrar limite maximo de vibracao, vibration velocity ou RMS em mm/s, use esse valor em vibracaoMaxima.
- Se temperaturaIdeal nao estiver clara, mas temperaturaMaxima estiver clara, estime temperaturaIdeal como 75% da temperaturaMaxima.
- Se vibracaoIdeal nao estiver clara, mas vibracaoMaxima estiver clara, estime vibracaoIdeal como 50% da vibracaoMaxima.
- Quando estimar temperaturaIdeal ou vibracaoIdeal, adicione em observacoes que o valor foi estimado com base no limite maximo do manual.

Maquina cadastrada:
${JSON.stringify(maquina || {}, null, 2)}

Trechos relevantes:
${trechos.map((trecho, index) => `TRECHO ${index + 1}\n${trecho}`).join("\n\n")}
`.trim();

    const text = await GroqService.generateText({
      temperature: 0,
      messages: [
        {
          role: "system",
          content: "Voce extrai dados tecnicos de manuais industriais e responde apenas JSON valido."
        },
        { role: "user", content: prompt }
      ]
    });

    return this.parseJson(text);
  }

  static parseJson(text) {
    try {
      return JSON.parse(text);
    } catch (error) {
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");

      if (start >= 0 && end > start) {
        return JSON.parse(text.slice(start, end + 1));
      }

      throw new AppError("A IA nao retornou especificacoes em JSON valido.", 502);
    }
  }

  static safeFilename(filename) {
    const cleaned = String(filename)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    return `${Date.now()}-${cleaned || "manual.pdf"}`;
  }
}

module.exports = MaquinaManualService;
