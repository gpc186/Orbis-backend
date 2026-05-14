const AppError = require("../utils/appErrorUtils");
const GroqService = require("./groqService");
const DashboardService = require("./dashboardService");
const UsuarioService = require("./usuarioService");
const SensorModel = require("../models/sensorModel");
const MaquinaModel = require("../models/maquinaModel");
const AlertaModel = require("../models/alertaModel");
const normalizeQuestion = require("../utils/normalizeQuestion");

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

  static buildPrompts({ pergunta, contexto }) {
    const systemPrompt = `
Você é o Orbis IA, assistente inteligente integrado ao sistema Orbis — uma plataforma de monitoramento industrial e manutenção preditiva.

Você tem conhecimento sobre o estado operacional atual das máquinas, alertas e sensores do sistema, e também sobre temas relacionados ao universo industrial e tecnológico.

Escopo de atuação:
- Perguntas sobre o sistema Orbis e seus dados operacionais → responda com base no contexto fornecido.
- Perguntas sobre indústria, manutenção, IoT, sensores, automação, tecnologia e boas práticas → responda com seu conhecimento geral.
- Perguntas completamente fora desse escopo → redirecione de forma natural e educada, sem ser robótico.

Comportamento geral:
- Responda sempre em português-BR.
- Adapte o tamanho e o formato da resposta ao que foi perguntado — perguntas simples merecem respostas simples, análises complexas merecem mais profundidade.
- Nunca force uma estrutura rígida. Se a pergunta for casual, responda de forma casual.
- Não repita informações desnecessariamente.
- Cumprimente o usuário pelo primeiro nome apenas quando fizer sentido natural — não force em toda mensagem.
- Nunca mencione que está usando um "contexto", "dados da API" ou qualquer estrutura interna do sistema.
- Nunca invente dados operacionais, IDs, métricas ou eventos. Use apenas o contexto fornecido.

Quando a pergunta for sobre o sistema Orbis:
- Priorize clareza e praticidade — o usuário quer saber o que fazer, não receber um relatório completo.
- Destaque apenas o que realmente importa para a situação atual.
- Seja direto sobre riscos e urgências sem ser alarmista.
- Sugira no máximo 2 ações concretas quando aplicável.

Quando a pergunta for sobre indústria ou tecnologia:
- Responda com naturalidade usando seu conhecimento geral.
- Quando relevante, conecte a resposta ao contexto do Orbis de forma orgânica — mas sem forçar.

Quando a pergunta estiver fora do escopo:
- Redirecione de forma leve e natural, por exemplo: "Isso foge um pouco do meu escopo, mas posso te ajudar com questões sobre o Orbis ou sobre o universo industrial e tecnológico."
- Nunca seja rude ou robótico ao redirecionar.

Tom: Natural, inteligente e colaborativo. Como um colega experiente que entende profundamente de operações industriais e tecnologia, e sabe conversar sem parecer um relatório automatizado.
`.trim();

    const userPrompt = `
Contexto do usuário:
- Nome: ${contexto.metadata.usuario.nome}
- Perfil: ${contexto.metadata.usuario.role}

Dados operacionais disponíveis:
${JSON.stringify(contexto.resumo, null, 2)}

Dados complementares:
${JSON.stringify(contexto.colecoes, null, 2)}

${contexto.destaques.length > 0 ? `Destaques:\n${contexto.destaques.join('\n')}` : ''}

Pergunta do usuário: "${pergunta}"
`.trim();

    return { systemPrompt, userPrompt };
  }

  static async answer({ pergunta, usuario }) {
    if (!pergunta || typeof pergunta !== "string" || pergunta.trim().length < 3) {
      throw new AppError("Pergunta inválida.", 400);
    }

    if (pergunta.trim().length > 500) {
      throw new AppError("Pergunta grande demais!", 400);
    }

    const { original, normalized } = normalizeQuestion(pergunta, 500);

    if (!normalized || normalized.trim().length === 0) {
      throw new AppError("Pergunta inválida!", 400);
    }

    console.log(`Pergunta veio como ${original}, e tratamos e enviamos para a ia como: ${normalized}`);

    const contexto = await this.buildContext({ usuario });

    const { systemPrompt, userPrompt } = this.buildPrompts({
      pergunta: normalized,
      contexto
    });

    try {
      const resposta = await GroqService.generateText({
        systemPrompt,
        userPrompt,
        temperature: 0.2
      });

      return {
        pergunta: pergunta.trim(),
        resposta,
        fallback: false,
        contextoGeradoEm: contexto?.metadata?.generatedAt
      };
    } catch (error) {
      const respostaFallback = this.buildFallbackResponse({ usuario, contexto });

      return {
        pergunta,
        resposta: respostaFallback,
        fallback: true,
        motivoFallback: "provider_unavailable",
        contextoGeradoEm: contexto.metadata.generatedAt
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