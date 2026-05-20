const AppError = require("../utils/appErrorUtils");
const GroqService = require("./groqService");
const DashboardService = require("./dashboardService");
const UsuarioService = require("./usuarioService");
const SensorModel = require("../models/sensorModel");
const MaquinaModel = require("../models/maquinaModel");
const AlertaModel = require("../models/alertaModel");
const normalizeQuestion = require("../utils/normalizeQuestion");
const { tools, executeTool } = require("./aiTools/registry");

class DashboardAiService {
  static getContextLimit() {
    const n = Number(process.env.AI_MAX_CONTEXT_ITEMS || 5);
    if (Number.isNaN(n) || n <= 0) return 5;
    return n;
  }

  static async buildContext({ usuario }) {
    const limit = this.getContextLimit();

    const resumo = await DashboardService.resume()

    const topAlertas = await AlertaModel.listTopAtivos({ limit });
    const maquinasCriticas = await MaquinaModel.listPioresIntegridade({ limit });
    const sensoresOffline = await SensorModel.listOfflineRecentes({ limit });

    const destaques = [];

    if ((resumo.alertasAtivos || 0) > 0) {
      destaques.push(`${resumo.alertasAtivos} alertas ativos no momento.`);
    }
    if ((resumo.maquinasEmAlerta || 0) > 0) {
      destaques.push(`${resumo.maquinasEmAlerta} máquinas em alerta.`);
    }
    if ((resumo.alertaSemAtendimento || 0) > 0) {
      destaques.push(`${resumo.alertaSemAtendimento} alertas sem atendimento.`);
    }

    const usuarioPedinte = await UsuarioService.findById(usuario.id);

    return {
      metadata: {
        generatedAt: new Date().toISOString(),
        usuario: {
          id: usuario.id,
          nome: usuarioPedinte.nome,
          role: usuario.role
        }
      },
      resumo: {
        totalMaquinas: resumo?.totalMaquinas ?? 0,
        maquinasEmAlerta: resumo?.maquinasEmAlerta ?? 0,
        maquinasFuncionando: resumo?.maquinasFuncionando ?? 0,
        alertasAtivos: resumo?.alertasAtivos ?? 0,
        alertasHoje: resumo?.alertasHoje ?? 0,
        tecnicosAtivos: resumo?.tecnicosAtivos ?? 0,
        integridadeMedia: resumo?.integridadeMedia ?? 0,
        sensoresOnline: resumo?.sensoresOnline ?? 0,
        alertaSemAtendimento: resumo?.alertaSemAtendimento ?? 0,
        alertasAtendidosHoje: resumo?.alertasAtendidosHoje ?? 0
      },
      colecoes: {
        topAlertas: topAlertas.slice(0, limit),
        maquinasCriticas: maquinasCriticas.slice(0, limit),
        sensoresOffline: sensoresOffline.slice(0, limit)
      },
      destaques: destaques.slice(0, limit)
    };
  }

  static buildPrompts({ pergunta, contexto, historico = [] }) {
    const systemPrompt = `
Você é o Orb IA, assistente inteligente integrado ao sistema Orbis — uma plataforma de monitoramento industrial e manutenção preditiva.
O orbis é um sistema que foi feito exclusivamente para uma empresa, então perguntas sobre os equipamentos, alertas e etc, são da empresa em sim,não da plataforma

Você tem conhecimento sobre o estado operacional atual das máquinas, alertas e sensores do sistema, e também sobre temas relacionados ao universo industrial e tecnológico.

Escopo de atuação:
- Perguntas sobre o sistema Orbis e seus dados operacionais → responda com base no contexto fornecido.
- Perguntas sobre indústria, manutenção, IoT, sensores, automação, tecnologia, TI e boas práticas → responda com seu conhecimento geral.
- Dos temas mencionados anteriormente, eles não necessariamente precisam ser relacionado ao orbis, pois o usuario pode querer tirar uma duvida sobre algo relacionado aos temas anteriores sem ser necessáriamente relacionado ao orbis, porém, se for algo fora do escopo, siga a instrução de redirecionamento abaixo
- Perguntas completamente fora desse escopo → redirecione de forma natural e educada e pergunte se ele tem alguma duvida sobre algo relacionado ao orbis, sem ser robótico.

Comportamento geral:
- Responda sempre na linguagem que o usuario perguntar.
- Adapte o tamanho e o formato da resposta ao que foi perguntado — perguntas simples merecem respostas simples, análises complexas merecem mais profundidade.
- Nunca force uma estrutura rígida. Se a pergunta for casual, responda de forma casual, e não precisa responder de uma maneira muito longa se não for necessário, o tamanho da resposta depende da complexidade.
- Não repita informações desnecessariamente.
- Cumprimente o usuário pelo primeiro nome apenas quando fizer sentido natural — não force em toda mensagem.
- Nunca mencione que está usando um "contexto", "dados da API" ou qualquer estrutura interna do sistema.
- Nunca invente dados operacionais, IDs, métricas ou eventos. Use apenas o contexto fornecido.

Quando a pergunta for sobre o sistema Orbis:
- Priorize clareza e praticidade — o usuário quer saber o que fazer, não receber um relatório completo.
- Destaque apenas o que realmente importa para a situação atual.
- Seja direto sobre riscos e urgências sem ser alarmista.
- Sugira no máximo 2 ações concretas quando aplicável.

Quando a pergunta for sobre indústria ou tecnologia, não necessariamente sendo ligado ao orbis:
- Responda com naturalidade usando seu conhecimento geral.
- Quando relevante, conecte a resposta ao contexto do Orbis de forma orgânica — mas sem forçar.

Quando a pergunta estiver fora do escopo:
- Redirecione de forma leve e natural, por exemplo: "Isso foge um pouco do meu escopo, mas posso te ajudar com questões sobre o Orbis ou sobre o universo industrial e tecnológico."
- Nunca seja rude ou robótico ao redirecionar.
- Caso a pergunta seja muito fora do escopo, por exemplo, perguntar por uma receita de bolo de cenoura, apenas ignore, não responda sobre, por mais que o usuario insista e redirecione como o primeiro exemplo deste tópico.

Quando usar os tools:
- Quando a pergunta exigir consultar ou executar dados especificos do sistema, use as tools disponiveis.
- Nao invente status de tecnico, maquinas ou usuarios se houver uma tool apropriada.
- Se faltar um dado obrigatorio para usar a tool, pergunte ao usuario.

Tom: Natural, inteligente e colaborativo. Como um colega experiente que entende profundamente de operações industriais e tecnologia, e sabe conversar sem parecer um relatório automatizado.
`.trim();

    const contextPrompt = `
Contexto do usuário:
- Nome: ${contexto.metadata.usuario.nome}
- Perfil: ${contexto.metadata.usuario.role}

Dados operacionais disponíveis:
${JSON.stringify(contexto.resumo, null, 2)}

Dados complementares:
${JSON.stringify(contexto.colecoes, null, 2)}

${contexto.destaques.length > 0 ? `Destaques:\n${contexto.destaques.join('\n')}` : ''}
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

  static async answer({ pergunta, usuario, historico }) {
    if (!pergunta || typeof pergunta !== "string" || pergunta.trim().length < 3) {
      throw new AppError("Pergunta invÃ¡lida.", 400);
    }

    if (pergunta.trim().length > 500) {
      throw new AppError("Pergunta grande demais!", 400);
    }

    const { original, normalized } = normalizeQuestion(pergunta, 500);

    console.log(`Recebemos a pergunta para a ia como ${original}, e tratamos para que ele ficasse assim ${normalized}`);

    if (!normalized || normalized.trim().length === 0) {
      throw new AppError("Pergunta invÃ¡lida!", 400);
    }

    const historicoSeguro = this.sanitizeHistory(historico);
    const contexto = await this.buildContext({ usuario });

    const { messages } = this.buildPrompts({
      pergunta: normalized,
      contexto,
      historico: historicoSeguro
    });

    try {
      const firstMessage = await GroqService.generateWithTools({
        messages,
        tools,
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

      const toolMessages = [];

      for (const toolCall of firstMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments || "{}");

        const result = await executeTool({
          name: toolName,
          args,
          usuario
        });

        toolMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        });
      }

      const finalMessage = await GroqService.generateWithTools({
        messages: [
          ...messages,
          firstMessage,
          ...toolMessages
        ],
        tools,
        temperature: 0.2
      });

      const finalText =
        typeof finalMessage?.content === "string"
          ? finalMessage.content.trim()
          : "";

      if (!finalText) {
        throw new AppError("Resposta final vazia do provedor de IA.", 502);
      }

      return {
        pergunta: pergunta.trim(),
        resposta: finalText,
        fallback: false,
        contextoGeradoEm: contexto.metadata.generatedAt,
        usedHistoryCount: historicoSeguro.length
      };
    } catch (error) {
      if (error instanceof AppError && error.statusCode < 500) {
        throw error;
      }

      const respostaFallback = this.buildFallbackResponse({ usuario, contexto });

      return {
        pergunta: pergunta.trim(),
        resposta: respostaFallback,
        fallback: true,
        motivoFallback: "provider_unavailable",
        contextoGeradoEm: contexto.metadata.generatedAt,
        usedHistoryCount: historicoSeguro.length
      };
    }
  }


  static buildFallbackResponse({ usuario, contexto }) {
    const nome = usuario?.nome || "usuário";
    const r = contexto?.resumo || {};

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
