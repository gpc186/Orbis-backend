const Groq = require("groq-sdk");
const AppError = require("../utils/appErrorUtils");

class GroqService {
  static getConfig() {
    const { GROQ_API_KEY, GROQ_MODEL } = process.env;

    if (!GROQ_API_KEY) {
      throw new AppError("GROQ_API_KEY não configurada.", 500);
    }

    return {
      apiKey: GROQ_API_KEY,
      model: GROQ_MODEL || "llama-3.3-70b-versatile"
    };
  }

  static getClient() {
    const { apiKey } = this.getConfig();
    return new Groq({ apiKey });
  }

  static async generateText({ systemPrompt, userPrompt, temperature = 0.2 }) {
    if (!userPrompt || typeof userPrompt !== "string" || userPrompt.trim().length < 3) {
      throw new AppError("Prompt inválido para IA.", 400);
    }

    const client = this.getClient();
    const { model } = this.getConfig();

    try {
      const completion = await client.chat.completions.create({
        model,
        temperature,
        messages: [
          {
            role: "system",
            content: systemPrompt || "Você é um assistente técnico do sistema Orbis."
          },
          {
            role: "user",
            content: userPrompt.trim()
          }
        ]
      });

      const text = completion?.choices?.[0]?.message?.content?.trim();

      if (!text) {
        throw new AppError("Resposta vazia do provedor de IA.", 502);
      }

      return text;
    } catch (error) {
      if (error?.status === 429) {
        throw new AppError("Limite de uso da IA atingido. Tente novamente em instantes.", 429);
      }

      throw new AppError("Falha ao consultar a IA (Groq).", 502);
    }
  }
}

module.exports = GroqService;