const AppError = require("../utils/appErrorUtils");
const logger = require("../utils/logger");
const GroqService = require("./groqService");

const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

class EmbeddingService {
  static getConfig() {
    const provider = String(
      process.env.EMBEDDING_PROVIDER || (process.env.GEMINI_API_KEY ? "gemini" : "groq")
    ).toLowerCase();

    return {
      provider,
      geminiApiKey: process.env.GEMINI_API_KEY,
      geminiModel: process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001",
      geminiBatchSize: Number(process.env.GEMINI_EMBEDDING_BATCH_SIZE || 10),
      geminiOutputDimensionality: process.env.GEMINI_EMBEDDING_DIMENSIONS
        ? Number(process.env.GEMINI_EMBEDDING_DIMENSIONS)
        : null,
      groqModel: process.env.GROQ_EMBEDDING_MODEL || "nomic-embed-text-v1_5"
    };
  }

  static getModelLabel() {
    const config = this.getConfig();
    const model = config.provider === "gemini" ? config.geminiModel : config.groqModel;

    return `${config.provider}:${model}`;
  }

  static async generateEmbeddings({ input, type = "document" }) {
    const config = this.getConfig();

    if (config.provider === "gemini") {
      return this.generateGeminiEmbeddings({ input, type, config });
    }

    if (config.provider === "groq") {
      return GroqService.generateEmbeddings({ input, type });
    }

    throw new AppError("Provedor de embeddings invalido.", 500);
  }

  static async generateGeminiEmbeddings({ input, type, config = this.getConfig() }) {
    const values = Array.isArray(input) ? input : [input];
    const cleaned = values
      .map((item) => String(item || "").trim())
      .filter((item) => item.length > 0);

    if (cleaned.length === 0) {
      throw new AppError("Texto invalido para embedding.", 400);
    }

    if (!config.geminiApiKey) {
      throw new AppError("GEMINI_API_KEY nao configurada.", 500);
    }

    const batchSize = Number.isInteger(config.geminiBatchSize) && config.geminiBatchSize > 0
      ? config.geminiBatchSize
      : 10;
    const embeddings = [];

    for (let start = 0; start < cleaned.length; start += batchSize) {
      const batch = cleaned.slice(start, start + batchSize);
      const response = await this.requestGeminiBatchEmbeddings({ batch, type, config });
      embeddings.push(...response);
    }

    if (embeddings.length !== cleaned.length) {
      throw new AppError("Resposta invalida do provedor de embeddings.", 502);
    }

    return embeddings;
  }

  static async requestGeminiBatchEmbeddings({ batch, type, config }) {
    const model = this.normalizeGeminiModel(config.geminiModel);
    const endpoint = `${GEMINI_API_BASE_URL}/${model}:batchEmbedContents`;
    const supportsTaskType = model.includes("gemini-embedding-001");
    const taskType = type === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT";
    const outputDimensionality = this.parseOutputDimensionality(config.geminiOutputDimensionality);

    const requests = batch.map((text) => {
      const request = {
        model,
        content: {
          parts: [{ text: supportsTaskType ? text : this.prefixGeminiEmbedding2Text({ text, type }) }]
        }
      };

      if (supportsTaskType) {
        request.taskType = taskType;
      }

      if (outputDimensionality) {
        request.outputDimensionality = outputDimensionality;
      }

      return request;
    });

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": config.geminiApiKey
        },
        body: JSON.stringify({ requests })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        logger.error("gemini_embedding_error", {
          model,
          statusCode: response.status,
          error: data
        });

        if (response.status === 429) {
          throw new AppError("Limite de uso da IA atingido. Tente novamente em instantes.", 429);
        }

        throw new AppError("Falha ao gerar embeddings com a IA (Gemini).", 502);
      }

      const embeddings = data?.embeddings?.map((item) => item?.values);

      if (!Array.isArray(embeddings) || embeddings.some((embedding) => !Array.isArray(embedding))) {
        throw new AppError("Resposta invalida do provedor de embeddings.", 502);
      }

      return embeddings;
    } catch (error) {
      if (error instanceof AppError) throw error;

      logger.error("gemini_embedding_error", {
        model,
        statusCode: error?.status || 502,
        error
      });

      throw new AppError("Falha ao gerar embeddings com a IA (Gemini).", 502);
    }
  }

  static normalizeGeminiModel(model) {
    const cleanModel = String(model || "gemini-embedding-001").trim();
    return cleanModel.startsWith("models/") ? cleanModel : `models/${cleanModel}`;
  }

  static parseOutputDimensionality(value) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  static prefixGeminiEmbedding2Text({ text, type }) {
    const prefix = type === "query"
      ? "Represent this search query for retrieving relevant technical manual passages:"
      : "Represent this technical manual passage for retrieval:";

    return `${prefix}\n${text}`;
  }
}

module.exports = EmbeddingService;
