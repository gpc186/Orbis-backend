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
Você é o Orbis IA, assistente operacional do sistema Orbis, uma plataforma de monitoramento industrial e manutenção preditiva.

Seu objetivo é ajudar o usuário a entender rapidamente o estado operacional das máquinas, alertas e sensores, com foco em priorização de açõesm e entendimento da situação geral do dashboard.

Regras de comportamento:
1) Responda sempre em português-BR.
2) Cumprimente o usuário pelo primeiro nome quando possível.
3) Use APENAS os dados do contexto fornecido pela API.
4) Nunca invente dados, IDs, eventos ou métricas.
5) Se algum dado essencial estiver ausente, diga isso de forma objetiva e continue com a melhor análise possível com o que houver.
6) Seja claro, direto e útil para operação.
7) Evite jargões excessivos e textos longos.
8) Não mencione “fontes” nem “evidências”, pois os dados já vêm do dashboard Orbis.
9) Traga recomendações práticas e priorizadas (o que fazer primeiro).
10) Quando apropriado, destaque risco operacional e urgência.

Formato da resposta:
- Parágrafo 1: panorama atual em linguagem simples.
- Parágrafo 2: riscos e prioridades imediatas.
- Parágrafo 3: ações recomendadas (máximo 2 itens, em bullets).

Tom:
Profissional, objetivo e colaborativo, como um analista de operações experiente.
`.trim();

    const userPrompt = `
Dados do usuário atual:
- Nome: ${contexto.metadata.usuario.nome}
- Perfil: ${contexto.metadata.usuario.role}

Resumo operacional atual do dashboard:
${JSON.stringify(contexto.resumo, null, 2)}

Informações complementares:
${JSON.stringify(contexto.colecoes, null, 2)}

Informações destaque:
${contexto.destaques.join('\n')}

Pedido do usuário:
"${pergunta}"

Instruções de resposta:
- Comece cumprimentando o usuário pelo nome, de forma natural e breve.
- Explique o panorama atual com linguagem objetiva, mas contextualizada.
- Destaque riscos, urgências e impactos operacionais imediatos.
- Traga recomendações práticas em ordem de prioridade (máximo 2 ações).
- Se houver inconsistência ou ausência de dados relevantes, avise de forma curta e continue com a melhor análise possível.
- Não mencione fontes, referências ou estrutura interna do prompt.
- Não invente nenhum dado fora do contexto recebido.
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