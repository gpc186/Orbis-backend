const assert = require("node:assert/strict");
const test = require("node:test");

const DashboardAiService = require("./dashboardAiService");
const GroqService = require("./groqService");
const UsuarioService = require("./usuarioService");
const AiToolsRegistry = require("./aiTools/registry");
const AiConfirmationService = require("./aiConfirmationService");
const AppError = require("../utils/appErrorUtils");

test("DashboardAiService faz fallback quando a resposta final da tool volta sem texto", async () => {
  const originalBuildContext = DashboardAiService.buildContext;
  const originalBuildPrompts = DashboardAiService.buildPrompts;
  const originalGenerateWithTools = GroqService.generateWithTools;
  const originalGenerateText = GroqService.generateText;
  const originalFindByNome = UsuarioService.findByNome;

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

  GroqService.generateWithTools = async () => ({
    role: "assistant",
    tool_calls: [{
      id: "tool-call-1",
      type: "function",
      function: {
        name: "buscar_usuario_por_nome",
        arguments: JSON.stringify({ nome: "Carlos" })
      }
    }]
  });

  GroqService.generateText = async () => {
    throw new AppError("Resposta final vazia do provedor de IA.", 502);
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
    GroqService.generateText = originalGenerateText;
    UsuarioService.findByNome = originalFindByNome;
  }
});

test("DashboardAiService trata tool call sem argumentos como objeto vazio", async () => {
  const originalBuildContext = DashboardAiService.buildContext;
  const originalBuildPrompts = DashboardAiService.buildPrompts;
  const originalGenerateWithTools = GroqService.generateWithTools;
  const originalGenerateText = GroqService.generateText;
  const originalExecuteTool = AiToolsRegistry.executeTool;

  DashboardAiService.buildContext = async () => ({
    metadata: {
      generatedAt: "2026-05-20T12:00:00.000Z",
      usuario: { id: 1, nome: "Admin", role: "ADMIN" }
    },
    resumo: {}
  });

  DashboardAiService.buildPrompts = () => ({
    messages: [
      { role: "system", content: "Teste" },
      { role: "user", content: "Liste agendamentos" }
    ]
  });

  GroqService.generateWithTools = async () => ({
    role: "assistant",
    tool_calls: [{
      id: "tool-call-1",
      type: "function",
      function: {
        name: "listar_agendamentos_relatorio"
      }
    }]
  });

  AiToolsRegistry.executeTool = async ({ args }) => {
    assert.deepEqual(args, {});
    return { total: 0, agendamentos: [] };
  };

  GroqService.generateText = async () => "Nao ha agendamentos cadastrados.";

  try {
    const result = await DashboardAiService.answer({
      pergunta: "Liste agendamentos",
      usuario: { id: 1, nome: "Admin", role: "ADMIN" },
      historico: []
    });

    assert.equal(result.fallback, false);
    assert.equal(result.resposta, "Nao ha agendamentos cadastrados.");
  } finally {
    DashboardAiService.buildContext = originalBuildContext;
    DashboardAiService.buildPrompts = originalBuildPrompts;
    GroqService.generateWithTools = originalGenerateWithTools;
    GroqService.generateText = originalGenerateText;
    AiToolsRegistry.executeTool = originalExecuteTool;
  }
});

test("DashboardAiService retorna confirmacao para tool de escrita", async () => {
  const originalBuildContext = DashboardAiService.buildContext;
  const originalBuildPrompts = DashboardAiService.buildPrompts;
  const originalGenerateWithTools = GroqService.generateWithTools;
  const originalPrepareWriteToolAction = AiToolsRegistry.prepareWriteToolAction;
  const originalCreate = AiConfirmationService.create;

  DashboardAiService.buildContext = async () => ({
    metadata: {
      generatedAt: "2026-05-20T12:00:00.000Z",
      usuario: { id: 1, nome: "Admin", role: "ADMIN" }
    },
    resumo: {},
    colecoes: { topAlertas: [], maquinasCriticas: [], sensoresOffline: [] },
    destaques: []
  });

  DashboardAiService.buildPrompts = () => ({
    messages: [
      { role: "system", content: "Teste" },
      { role: "user", content: "Pause o agendamento 12" }
    ]
  });

  GroqService.generateWithTools = async () => ({
    role: "assistant",
    tool_calls: [{
      id: "tool-call-1",
      type: "function",
      function: {
        name: "pausar_agendamento_relatorio",
        arguments: JSON.stringify({ id: 12 })
      }
    }]
  });

  AiToolsRegistry.prepareWriteToolAction = async () => ({
    name: "pausar_agendamento_relatorio",
    args: { id: 12 },
    actionLabel: "Pausar agendamento",
    summary: { id: 12, nome: "Relatorio Semanal" }
  });

  AiConfirmationService.create = async () => ({
    id: "confirmation-1",
    actionName: "pausar_agendamento_relatorio",
    actionLabel: "Pausar agendamento",
    summary: { id: 12, nome: "Relatorio Semanal" },
    expiresAt: "2026-05-20T12:10:00.000Z"
  });

  try {
    const result = await DashboardAiService.answer({
      pergunta: "Pause o agendamento 12",
      usuario: { id: 1, nome: "Admin", role: "ADMIN" },
      historico: []
    });

    assert.equal(result.requiresConfirmation, true);
    assert.equal(result.confirmation.type, "tool_action");
    assert.equal(result.confirmation.actionLabel, "Pausar agendamento");
    assert.equal(result.confirmation.id, "confirmation-1");
  } finally {
    DashboardAiService.buildContext = originalBuildContext;
    DashboardAiService.buildPrompts = originalBuildPrompts;
    GroqService.generateWithTools = originalGenerateWithTools;
    AiToolsRegistry.prepareWriteToolAction = originalPrepareWriteToolAction;
    AiConfirmationService.create = originalCreate;
  }
});

test("DashboardAiService resolve cancelamento de confirmacao", async () => {
  const originalCancel = AiConfirmationService.cancel;
  const originalExecuteWriteTool = AiToolsRegistry.executeWriteTool;

  AiConfirmationService.cancel = async () => ({
    actionLabel: "Pausar agendamento"
  });

  AiToolsRegistry.executeWriteTool = async () => ({
    message: "nao deveria executar"
  });

  try {
    const result = await DashboardAiService.answer({
      pergunta: "cancelar acao pendente",
      usuario: { id: 1, nome: "Admin", role: "ADMIN" },
      confirmationResponse: {
        id: "confirmation-1",
        decision: "cancel"
      }
    });

    assert.equal(result.confirmationResolved, true);
    assert.equal(result.confirmationDecision, "cancel");
    assert.equal(result.requiresConfirmation, false);
  } finally {
    AiConfirmationService.cancel = originalCancel;
    AiToolsRegistry.executeWriteTool = originalExecuteWriteTool;
  }
});
