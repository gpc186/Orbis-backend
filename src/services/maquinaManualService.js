const { PDFParse } = require("pdf-parse");
const AppError = require("../utils/appErrorUtils");
const GroqService = require("./groqService");
const StorageService = require("./storageService");

const MANUAL_BUCKET = "machine-manuals";
const MAX_TEXT_CHARS = Number(process.env.MANUAL_MAX_TEXT_CHARS || 100000);
const CHUNK_SIZE = Number(process.env.MANUAL_CHUNK_SIZE || 1800);
const CHUNK_OVERLAP = Number(process.env.MANUAL_CHUNK_OVERLAP || 250);
const MAX_CHUNKS_TO_EMBED = Number(process.env.MANUAL_MAX_CHUNKS || 40);
const ANALYSIS_CHUNKS = Number(process.env.MANUAL_ANALYSIS_CHUNKS || 8);

class MaquinaManualService {
  static async buildManualData({ file, maquina, caminhoPrefixo }) {
    if (!file) return null;

    if (file.mimetype !== "application/pdf") {
      throw new AppError("Manual invalido. Envie um arquivo PDF.", 400);
    }

    const textoExtraido = await this.extractText(file.buffer);
    const chunks = this.chunkText(textoExtraido).slice(0, MAX_CHUNKS_TO_EMBED);

    if (chunks.length === 0) {
      throw new AppError("Nao foi possivel extrair texto do manual enviado.", 400);
    }

    const chunkTexts = chunks.map((chunk) => chunk.text);
    const chunkEmbeddings = await GroqService.generateEmbeddings({
      input: chunkTexts,
      type: "document"
    });
    const queryEmbedding = (await GroqService.generateEmbeddings({
      input: "temperatura ideal, temperatura maxima, vibracao ideal, vibracao maxima, limites operacionais, especificacoes tecnicas da maquina",
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
      textoExtraido: textoExtraido.slice(0, MAX_TEXT_CHARS),
      embedding: this.averageEmbedding(chunkEmbeddings),
      chunks: chunksComEmbedding,
      especificacoes,
      modeloEmbedding: GroqService.getConfig().embeddingModel,
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

  static selectRelevantChunks(chunks, queryEmbedding, limit) {
    return chunks
      .map((chunk) => ({
        ...chunk,
        score: this.cosineSimilarity(chunk.embedding, queryEmbedding)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .sort((a, b) => a.index - b.index);
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
- Use null quando o manual nao trouxer um valor claro.
- Nao invente valores.
- Se houver faixa ideal, use o maior valor seguro da faixa como ideal.
- Prefira Celsius quando o manual trouxer Celsius.
- Vibracao pode aparecer como mm/s, m/s2, g, Hz ou outra unidade; preserve a unidade.

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
