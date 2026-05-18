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
    const { GROQ_API_KEY, GROQ_MODEL } = process.env;

    if (!GROQ_API_KEY) {
      throw new AppError("GROQ_API_KEY nao configurada.", 500);
    }

    return {
      apiKey: GROQ_API_KEY,
      model: GROQ_MODEL || "llama-3.3-70b-versatile"
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
}

module.exports = GroqService;
