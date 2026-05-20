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
      const validRole = message && ["system", "user", "assistant", "tool"].includes(message.role);

      if (!validRole) {
        throw new AppError("Mensagens invalidas para IA.", 400);
      }

      if (message.role === "assistant") {
        const hasTextContent =
          typeof message.content === "string" && message.content.trim().length > 0;
        const hasToolCalls = Array.isArray(message.tool_calls) && message.tool_calls.length > 0;

        if (!hasTextContent && !hasToolCalls) {
          throw new AppError("Mensagens invalidas para IA.", 400);
        }

        continue;
      }

      if (message.role === "tool") {
        const validToolCallId =
          typeof message.tool_call_id === "string" &&
          message.tool_call_id.trim().length > 0;
        const validContent =
          typeof message.content === "string" &&
          message.content.trim().length > 0;

        if (!validToolCallId || !validContent) {
          throw new AppError("Mensagens invalidas para IA.", 400);
        }

        continue;
      }

      const validContent =
        typeof message.content === "string" &&
        message.content.trim().length > 0;

      if (!validContent) {
        throw new AppError("Mensagens invalidas para IA.", 400);
      }
    }
  }

  static validateTools(tools) {
    if (!Array.isArray(tools) || tools.length === 0) {
      throw new AppError("Tools invalidas para IA.", 400);
    }

    for (const tool of tools) {
      const fn = tool?.function;
      const validTool =
        tool?.type === "function" &&
        fn &&
        typeof fn.name === "string" &&
        fn.name.trim().length > 0 &&
        typeof fn.description === "string" &&
        fn.description.trim().length > 0 &&
        fn.parameters &&
        typeof fn.parameters === "object";

      if (!validTool) {
        throw new AppError("Tools invalidas para IA.", 400);
      }
    }
  }

  static async generateWithTools({ messages, tools, temperature = 0.2 }) {
    this.validateMessages(messages);
    this.validateTools(tools);

    const startedAt = Date.now();
    const client = this.getClient();
    const { model } = this.getConfig();

    try {
      logger.info("groq_tools_request_started", {
        model,
        messageCount: messages.length,
        toolCount: tools.length,
        temperature
      });

      const completion = await client.chat.completions.create({
        model,
        temperature,
        messages,
        tools,
        tool_choice: "auto"
      });

      const message = completion?.choices?.[0]?.message;
      const hasTextContent =
        typeof message?.content === "string" && message.content.trim().length > 0;
      const hasToolCalls = Array.isArray(message?.tool_calls) && message.tool_calls.length > 0;

      if (!hasTextContent && !hasToolCalls) {
        throw new AppError("Resposta vazia do provedor de IA.", 502);
      }

      logger.info("groq_tools_request_finished", {
        model,
        messageCount: messages.length,
        toolCount: tools.length,
        durationMs: Date.now() - startedAt
      });

      return message;
    } catch (error) {
      logger.error("groq_tools_request_error", {
        model,
        messageCount: messages.length,
        toolCount: tools.length,
        durationMs: Date.now() - startedAt,
        statusCode: error?.status || 502,
        error
      });

      if (error?.status === 429) {
        throw new AppError("Limite de uso da IA atingido. Tente novamente em instantes.", 429);
      }

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError("Falha ao consultar a IA (Groq).", 502);
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
