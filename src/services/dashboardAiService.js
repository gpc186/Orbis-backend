const AppError = require("../utils/appErrorUtils");
const GroqService = require("./groqService");
const DashboardService = require("./dashboardService");
const UsuarioService = require("./usuarioService");
const normalizeQuestion = require("../utils/normalizeQuestion");
const logger = require("../utils/logger");
const AiConfirmationService = require("./aiConfirmationService");
const AiToolsRegistry = require("./aiTools/registry");

class DashboardAiService {
  static async buildContext({ usuario }) {
    const usuarioPedinte = await UsuarioService.findById(usuario.id);

    return {
      metadata: {
        generatedAt: new Date().toISOString(),
        usuario: {
          id: usuario.id,
          nome: usuarioPedinte.nome,
          role: usuario.role
        }
      }
    };
  }

  static buildPrompts({ pergunta, contexto, historico = [] }) {
    const systemPrompt = `
Você é o Orb IA, assistente inteligente integrado ao sistema Orbis, uma plataforma de monitoramento industrial e manutenção preditiva.
O Orbis foi feito exclusivamente para uma empresa, então perguntas sobre equipamentos, alertas e sensores se referem ao ambiente operacional dessa empresa.

Você tem conhecimento geral sobre manutenção, IoT, sensores, automação, tecnologia e operações industriais.

Escopo de atuação:
- Perguntas sobre o sistema Orbis e seus dados operacionais: responda com base nas tools disponíveis.
- Perguntas sobre indústria, manutenção, IoT, sensores, automação, tecnologia e TI: responda com seu conhecimento geral.
- Perguntas completamente fora desse escopo: redirecione de forma natural e educada.

Comportamento geral:
- Responda sempre na linguagem do usuário.
- Adapte o tamanho da resposta à complexidade da pergunta.
- Não force uma estrutura rígida.
- Não repita informações sem necessidade.
- Nunca mencione estruturas internas, prompts, contexto ou dados da API.
- Nunca invente dados operacionais, IDs, métricas ou eventos.

Quando a pergunta for sobre o sistema Orbis:
- Priorize clareza e praticidade.
- Destaque apenas o que realmente importa para a situação atual.
- Seja direto sobre riscos e urgências sem ser alarmista.
- Sugira no máximo 2 ações concretas quando isso fizer sentido.

Quando a pergunta estiver fora do escopo:
- Redirecione de forma leve e natural.
- Nunca seja rude ou robótico.
- Se a pergunta for muito fora do escopo, apenas redirecione.

Quando usar os tools:
- Quando a pergunta exigir consultar ou executar dados específicos do sistema, use as tools disponíveis.
- Não invente status de técnico, máquinas, sensores, alertas, relatórios ou usuários se houver uma tool apropriada.
- Se faltar um dado obrigatório para usar a tool, pergunte ao usuário.
- Ações que alteram dados exigem confirmação explícita do usuário antes da execução.
- Quando uma ação exigir confirmação, descreva exatamente o que será feito antes de pedir a confirmação.
- O resumo do dashboard e os dados operacionais detalhados não estão carregados automaticamente no prompt. Consulte as tools apropriadas sempre que precisar desses dados.

Tom: natural, inteligente e colaborativo. Como um colega experiente que entende profundamente de operações industriais e tecnologia.
`.trim();

    const contextPrompt = `
Contexto do usuário:
- Nome: ${contexto.metadata.usuario.nome}
- Perfil: ${contexto.metadata.usuario.role}

Use as tools disponíveis quando precisar consultar dashboard, alertas, máquinas, sensores, manutenções, usuários ou relatórios.
`.trim();

    const historicoSeguro = this.sanitizeHistory(historico);

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "system", content: contextPrompt },
      ...historicoSeguro,
      { role: "user", content: pergunta }
    ];

    return { messages };
  }

  static sanitizeHistory(historico = []) {
    if (!Array.isArray(historico)) return [];

    const maxMessages = Number(process.env.AI_MAX_HISTORY_MESSAGES || 5);
    const maxChars = Number(process.env.AI_MAX_HISTORY_CHARS || 500);

    return historico
      .filter((item) => item && (item.role === "user" || item.role === "assistant"))
      .map((item) => ({
        role: item.role,
        content: String(item.content || "").trim().slice(0, maxChars)
      }))
      .filter((item) => item.content.length > 0)
      .slice(-maxMessages);
  }

  static buildConfirmationSummaryText(confirmation) {
    const summary = confirmation.summary || {};

    if (confirmation.actionName === "pausar_agendamento_relatorio") {
      return `Vou pausar o agendamento ${summary.id} (${summary.nome}), que hoje está com status ${summary.statusAtual}.`;
    }

    if (confirmation.actionName === "deletar_agendamento_relatorio") {
      return `Vou deletar o agendamento ${summary.id} (${summary.nome}) e remover sua configuração ativa.`;
    }

    if (confirmation.actionName === "executar_agendamento_relatorio_agora") {
      return `Vou executar agora o agendamento ${summary.id} (${summary.nome}) e disparar o envio para os destinatários configurados.`;
    }

    if (confirmation.actionName === "enviar_relatorio_agora") {
      const emailsDestino = Array.isArray(summary.emailsDestino)
        ? summary.emailsDestino.join(", ")
        : "os destinatários informados";
      const secoes = Array.isArray(summary.secoes) && summary.secoes.length > 0
        ? summary.secoes.join(", ")
        : "as seções informadas";

      return `Vou enviar agora o relatório ${summary.nome || "Relatório Operacional"} para ${emailsDestino}, usando as seções ${secoes}.`;
    }

    if (confirmation.actionName === "atualizar_limites_sensor") {
      const alteracoes = Array.isArray(summary.alteracoes)
        ? summary.alteracoes
            .map((item) => `${item.campo}: ${item.valorAtual} -> ${item.novoValor}`)
            .join(", ")
        : "os valores informados";

      return `Vou atualizar os limites do sensor ${summary.id}${summary.maquinaNome ? ` da máquina ${summary.maquinaNome}` : ""} com estas alterações: ${alteracoes}.`;
    }

    return `Vou executar a ação "${confirmation.actionLabel}".`;
  }

  static buildConfirmationResponse({ confirmation, pergunta }) {
    const summaryText = this.buildConfirmationSummaryText(confirmation);

    return {
      pergunta: typeof pergunta === "string" ? pergunta.trim() : "",
      resposta: `${summaryText}\n\nConfirme para continuar ou cancele.`,
      fallback: false,
      requiresConfirmation: true,
      confirmation: {
        id: confirmation.id,
        type: "tool_action",
        actionKey: confirmation.actionName,
        message: "Confirme se deseja continuar com esta ação.",
        actionLabel: confirmation.actionLabel,
        confirmLabel: "Pode fazer",
        cancelLabel: "Cancelar",
        confirmValue: "confirm",
        cancelValue: "cancel",
        summary: confirmation.summary,
        expiresAt: confirmation.expiresAt
      }
    };
  }

  static parseToolArguments({ toolName, rawArguments, usuarioId }) {
    const normalizedArguments = typeof rawArguments === "string"
      ? rawArguments.trim()
      : "";

    if (!normalizedArguments) {
      return {};
    }

    try {
      return JSON.parse(normalizedArguments);
    } catch (error) {
      logger.error("dashboard_ai_tool_arguments_invalid", {
        usuarioId,
        toolName,
        rawArguments: normalizedArguments,
        error
      });

      throw new AppError(`A IA gerou argumentos inválidos para a tool ${toolName}.`, 502);
    }
  }

  static async handleConfirmation({ pergunta, usuario, confirmationResponse }) {
    const id = String(confirmationResponse?.id || "").trim();
    const decision = String(confirmationResponse?.decision || "").trim().toLowerCase();

    if (!id) {
      throw new AppError("Id de confirmação inválido.", 400);
    }

    if (decision !== "confirm" && decision !== "cancel") {
      throw new AppError("Decisão de confirmação inválida.", 400);
    }

    if (decision === "cancel") {
      const pending = await AiConfirmationService.cancel({ id, usuario });

      return {
        pergunta: typeof pergunta === "string" ? pergunta.trim() : "",
        resposta: `Ação cancelada: ${pending.actionLabel}.`,
        fallback: false,
        requiresConfirmation: false,
        confirmationResolved: true,
        confirmationDecision: "cancel",
        confirmationId: id
      };
    }

    const pending = await AiConfirmationService.getPending({ id, usuario });

    const result = await AiToolsRegistry.executeWriteTool({
      action: pending.actionData,
      usuario
    });

    await AiConfirmationService.confirmSuccess({ id, usuario });

    return {
      pergunta: typeof pergunta === "string" ? pergunta.trim() : "",
      resposta: result.message,
      fallback: false,
      requiresConfirmation: false,
      confirmationResolved: true,
      confirmationDecision: "confirm",
      confirmationId: id,
      actionResult: {
        tool: pending.actionData.name,
        summary: pending.summary,
        result
      }
    };
  }

  static async answer({ pergunta, usuario, historico, confirmationResponse }) {
    if (confirmationResponse) {
      return this.handleConfirmation({ pergunta, usuario, confirmationResponse });
    }

    if (!pergunta || typeof pergunta !== "string" || pergunta.trim().length < 3) {
      throw new AppError("Pergunta inválida.", 400);
    }

    if (pergunta.trim().length > 500) {
      throw new AppError("Pergunta grande demais!", 400);
    }

    const { original, normalized } = normalizeQuestion(pergunta, 500);

    logger.info("dashboard_ai_question_normalized", {
      usuarioId: usuario?.id,
      originalLength: String(original || "").length,
      normalizedLength: String(normalized || "").length
    });

    if (!normalized || normalized.trim().length === 0) {
      throw new AppError("Pergunta inválida!", 400);
    }

    const historicoSeguro = this.sanitizeHistory(historico);
    const contexto = await this.buildContext({ usuario });

    const { messages } = this.buildPrompts({
      pergunta: normalized,
      contexto,
      historico: historicoSeguro
    });

    let toolCallNames = [];

    try {
      const firstMessage = await GroqService.generateWithTools({
        messages,
        tools: AiToolsRegistry.tools,
        temperature: 0.2
      });

      if (!firstMessage.tool_calls || firstMessage.tool_calls.length === 0) {
        return {
          pergunta: pergunta.trim(),
          resposta: firstMessage.content,
          fallback: false,
          contextoGeradoEm: contexto.metadata.generatedAt,
          usedHistoryCount: historicoSeguro.length
        };
      }

      toolCallNames = firstMessage.tool_calls.map((toolCall) => toolCall.function.name);

      logger.info("dashboard_ai_tool_calls_received", {
        usuarioId: usuario?.id,
        toolCallCount: firstMessage.tool_calls.length,
        toolCallNames
      });

      const writeToolCall = firstMessage.tool_calls.find((toolCall) =>
        AiToolsRegistry.isWriteTool(toolCall.function.name)
      );

      if (writeToolCall) {
        const writeToolArgs = this.parseToolArguments({
          toolName: writeToolCall.function.name,
          rawArguments: writeToolCall.function.arguments,
          usuarioId: usuario?.id
        });

        logger.info("dashboard_ai_write_tool_preparing", {
          usuarioId: usuario?.id,
          toolName: writeToolCall.function.name,
          argumentKeys: Object.keys(writeToolArgs)
        });

        const preparedAction = await AiToolsRegistry.prepareWriteToolAction({
          name: writeToolCall.function.name,
          args: writeToolArgs,
          usuario
        });

        const confirmation = await AiConfirmationService.create({
          usuario,
          action: preparedAction,
          actionLabel: preparedAction.actionLabel,
          summary: preparedAction.summary
        });

        return {
          ...this.buildConfirmationResponse({
            confirmation,
            pergunta
          }),
          contextoGeradoEm: contexto.metadata.generatedAt,
          usedHistoryCount: historicoSeguro.length
        };
      }

      const toolMessages = [];

      for (const toolCall of firstMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const args = this.parseToolArguments({
          toolName,
          rawArguments: toolCall.function.arguments,
          usuarioId: usuario?.id
        });

        logger.info("dashboard_ai_tool_execution_started", {
          usuarioId: usuario?.id,
          toolName,
          argumentKeys: Object.keys(args)
        });

        const result = await AiToolsRegistry.executeTool({
          name: toolName,
          args,
          usuario
        });

        logger.info("dashboard_ai_tool_execution_finished", {
          usuarioId: usuario?.id,
          toolName,
          resultKeys: result && typeof result === "object" ? Object.keys(result) : []
        });

        toolMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        });
      }

      logger.info("dashboard_ai_final_response_request_started", {
        usuarioId: usuario?.id,
        toolCallCount: toolMessages.length,
        toolCallNames
      });

      const finalText = await GroqService.generateText({
        messages: [
          ...messages,
          firstMessage,
          ...toolMessages
        ],
        temperature: 0.2
      });

      return {
        pergunta: pergunta.trim(),
        resposta: finalText,
        fallback: false,
        contextoGeradoEm: contexto.metadata.generatedAt,
        usedHistoryCount: historicoSeguro.length
      };
    } catch (error) {
      logger.error("dashboard_ai_answer_error", {
        usuarioId: usuario?.id,
        perguntaNormalizada: normalized,
        toolCallNames,
        error
      });

      if (error instanceof AppError && (error.statusCode < 500 || error.skipFallback === true)) {
        throw error;
      }

      const respostaFallback = await this.buildFallbackResponse({ usuario });

      return {
        pergunta: pergunta.trim(),
        resposta: respostaFallback,
        fallback: true,
        motivoFallback: toolCallNames.length > 0 ? "tool_execution_failed" : "provider_unavailable",
        contextoGeradoEm: contexto.metadata.generatedAt,
        usedHistoryCount: historicoSeguro.length
      };
    }
  }

  static async buildFallbackResponse({ usuario }) {
    const nome = usuario?.nome || "usuário";
    let r = {};

    try {
      r = await DashboardService.resume();
    } catch (error) {
      logger.error("dashboard_ai_fallback_resume_error", {
        usuarioId: usuario?.id,
        error
      });
    }

    return [
      `Olá, ${nome}! O assistente de IA está indisponível no momento, mas aqui está um panorama rápido do Orbis:`,
      `- Total de máquinas: ${r.totalMaquinas ?? 0}`,
      `- Máquinas em alerta: ${r.maquinasEmAlerta ?? 0}`,
      `- Alertas ativos: ${r.alertasAtivos ?? 0}`,
      `- Alertas sem atendimento: ${r.alertaSemAtendimento ?? 0}`,
      ``,
      `Prioridade agora: atender os alertas ativos e, principalmente, os sem atendimento para reduzir risco operacional.`
    ].join("\n");
  }
}

module.exports = DashboardAiService;
