const Groq = require("groq-sdk");
const AppError = require("../utils/appErrorUtils");
const logger = require("../utils/logger");

class GroqService {
  static #client = null;

  static getClient() {
    if (!this.#client) {
      const { apiKey } = this.getConfig();
      this.#client = new Groq({ apiKey });
    }

    return this.#client;
  }

  static getConfig() {
    const { GROQ_API_KEY, GROQ_MODEL, GROQ_EMBEDDING_MODEL } = process.env;

    if (!GROQ_API_KEY) {
      throw new AppError("GROQ_API_KEY nao configurada.", 500);
    }

    return {
      apiKey: GROQ_API_KEY,
      model: GROQ_MODEL || "llama-3.3-70b-versatile",
      embeddingModel: GROQ_EMBEDDING_MODEL || "nomic-embed-text-v1_5"
    };
  }

  static validateMessages(messages) {
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new AppError("Prompt invalido para IA.", 400);
    }

    for (const message of messages) {
      const validRole = message && ["system", "user", "assistant"].includes(message.role);
      const validContent =
        message &&
        typeof message.content === "string" &&
        message.content.trim().length > 0;

      if (!validRole || !validContent) {
        throw new AppError("Mensagens invalidas para IA.", 400);
      }
    }
  }

  static async generateText({ messages, temperature = 0.2 }) {
    this.validateMessages(messages);

    const startedAt = Date.now();
    const client = this.getClient();
    const { model } = this.getConfig();

    try {
      logger.info("groq_request_started", {
        model,
        messageCount: messages.length,
        temperature
      });

      const completion = await client.chat.completions.create({
        model,
        temperature,
        messages
      });

      const text = completion?.choices?.[0]?.message?.content?.trim();

      if (!text) {
        throw new AppError("Resposta vazia do provedor de IA.", 502);
      }

      logger.info("groq_request_finished", {
        model,
        messageCount: messages.length,
        durationMs: Date.now() - startedAt
      });

      return text;
    } catch (error) {
      logger.error("groq_request_error", {
        model,
        messageCount: messages.length,
        durationMs: Date.now() - startedAt,
        statusCode: error?.status || 502,
        error
      });

      if (error?.status === 429) {
        throw new AppError("Limite de uso da IA atingido. Tente novamente em instantes.", 429);
      }

      throw new AppError("Falha ao consultar a IA (Groq).", 502);
    }
  }

  static async generateEmbeddings({ input, type = "document" }) {
    const values = Array.isArray(input) ? input : [input];
    const cleaned = values
      .map((item) => String(item || "").trim())
      .filter((item) => item.length > 0);

    if (cleaned.length === 0) {
      throw new AppError("Texto invalido para embedding.", 400);
    }

    const prefix = type === "query" ? "search_query" : "search_document";
    const client = this.getClient();
    const { embeddingModel } = this.getConfig();

    try {
      const response = await client.embeddings.create({
        model: embeddingModel,
        input: cleaned.map((text) => `${prefix}: ${text}`),
        encoding_format: "float"
      });

      const embeddings = response?.data
        ?.sort((a, b) => a.index - b.index)
        ?.map((item) => item.embedding);

      if (!embeddings || embeddings.length !== cleaned.length) {
        throw new AppError("Resposta invalida do provedor de embeddings.", 502);
      }

      return embeddings;
    } catch (error) {
      logger.error("groq_embedding_error", {
        model: embeddingModel,
        inputCount: cleaned.length,
        statusCode: error?.status || 502,
        error
      });

      if (error instanceof AppError) throw error;
      if (error?.status === 429) {
        throw new AppError("Limite de uso da IA atingido. Tente novamente em instantes.", 429);
      }

      throw new AppError("Falha ao gerar embeddings com a IA (Groq).", 502);
    }
  }
}

module.exports = GroqService;
