const assert = require("node:assert/strict");
const test = require("node:test");

const DashboardAiService = require("./dashboardAiService");
const GroqService = require("./groqService");
const UsuarioService = require("./usuarioService");

test("DashboardAiService faz fallback quando a resposta final da tool volta sem texto", async () => {
  const originalBuildContext = DashboardAiService.buildContext;
  const originalBuildPrompts = DashboardAiService.buildPrompts;
  const originalGenerateWithTools = GroqService.generateWithTools;
  const originalFindByNome = UsuarioService.findByNome;

  let callCount = 0;

  DashboardAiService.buildContext = async () => ({
    metadata: {
      generatedAt: "2026-05-20T12:00:00.000Z",
      usuario: {
        id: 1,
        nome: "Admin",
        role: "ADMIN"
      }
    },
    resumo: {
      totalMaquinas: 0,
      maquinasEmAlerta: 0,
      maquinasFuncionando: 0,
      alertasAtivos: 0,
      alertasHoje: 0,
      tecnicosAtivos: 0,
      integridadeMedia: 0,
      sensoresOnline: 0,
      alertaSemAtendimento: 0,
      alertasAtendidosHoje: 0
    },
    colecoes: {
      topAlertas: [],
      maquinasCriticas: [],
      sensoresOffline: []
    },
    destaques: []
  });

  DashboardAiService.buildPrompts = () => ({
    messages: [
      { role: "system", content: "Teste" },
      { role: "user", content: "Procure o usuario Carlos" }
    ]
  });

  UsuarioService.findByNome = async () => ({
    total: 1,
    dados: [{
      id: 7,
      nome: "Carlos Silva",
      email: "carlos@orbis.com",
      role: "TECNICO",
      ativo: true,
      especialidade: "Vibracao",
      telefone: "11999999999"
    }]
  });

  GroqService.generateWithTools = async () => {
    callCount += 1;

    if (callCount === 1) {
      return {
        role: "assistant",
        tool_calls: [{
          id: "tool-call-1",
          type: "function",
          function: {
            name: "buscar_usuario_por_nome",
            arguments: JSON.stringify({ nome: "Carlos" })
          }
        }]
      };
    }

    return {
      role: "assistant",
      content: "   "
    };
  };

  try {
    const result = await DashboardAiService.answer({
      pergunta: "Carlos",
      usuario: { id: 1, nome: "Admin", role: "ADMIN" },
      historico: []
    });

    assert.equal(result.fallback, true);
    assert.equal(result.motivoFallback, "provider_unavailable");
    assert.equal(typeof result.resposta, "string");
    assert.ok(result.resposta.length > 0);
  } finally {
    DashboardAiService.buildContext = originalBuildContext;
    DashboardAiService.buildPrompts = originalBuildPrompts;
    GroqService.generateWithTools = originalGenerateWithTools;
    UsuarioService.findByNome = originalFindByNome;
  }
});
