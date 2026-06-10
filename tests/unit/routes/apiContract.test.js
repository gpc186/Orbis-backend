const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";
process.env.ESP32_API_KEY = process.env.ESP32_API_KEY || "esp-test-key";

const createApp = require("../../../src/app");
const UsuarioModel = require("../../../src/models/usuarioModel");
const UsuarioService = require("../../../src/services/usuarioService");
const SensorService = require("../../../src/services/sensorService");
const MaquinaService = require("../../../src/services/maquinaService");
const leituraService = require("../../../src/services/leituraService");
const AlertaService = require("../../../src/services/alertaService");
const ManutencaoService = require("../../../src/services/manutencaoService");
const HistoricoIntegridadeService = require("../../../src/services/historicoIntegridadeService");
const ReadinessService = require("../../../src/services/readinessService");
const RelatorioAgendamentoService = require("../../../src/services/relatorioAgendamentoService");
const RelatorioExecucaoService = require("../../../src/services/relatorioExecucaoService");
const DashboardAiService = require("../../../src/services/dashboardAiService");
const ContatoService = require("../../../src/services/contatoService");
const PerfilService = require("../../../src/services/perfilService");
const ResetSenhaService = require("../../../src/services/resetSenhaService");
const DashboardService = require("../../../src/services/dashboardService");
const { generateAccessToken } = require("../../../src/utils/jwtUtils");

const patches = [];

afterEach(() => {
  while (patches.length > 0) {
    const { target, key, original } = patches.pop();
    target[key] = original;
  }
});

function patch(target, key, replacement) {
  patches.push({ target, key, original: target[key] });
  target[key] = replacement;
}

function tokenFor({ id = 1, role = "ADMIN" } = {}) {
  return generateAccessToken({ id, role });
}

function mockAuthenticatedUsers() {
  patch(UsuarioModel, "findById", async (id) => {
    const numericId = Number(id);

    if (numericId === 1) {
      return { id: numericId, nome: "Admin", role: "ADMIN", ativo: true };
    }

    if (numericId === 2) {
      return { id: numericId, nome: "Tecnico", role: "TECNICO", ativo: true };
    }

    if (numericId === 3) {
      return { id: numericId, nome: "Visitante", role: "VISITANTE", ativo: true };
    }

    return null;
  });
}

async function withServer(run) {
  const server = http.createServer(createApp());

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    return await run(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function request(baseUrl, path, { method = "GET", token, body, headers = {} } = {}) {
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body && !isFormData ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers
    },
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;

  return { status: response.status, json, text };
}

function createPngBlob() {
  const pngBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
  const buffer = Buffer.from(pngBase64, "base64");
  return new Blob([buffer], { type: "image/png" });
}

function createPdfBlob() {
  const content = "%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF";
  return new Blob([Buffer.from(content)], { type: "application/pdf" });
}

test("GET /health responde com status basico da API", async () => {
  await withServer(async (baseUrl) => {
    const response = await request(baseUrl, "/health");

    assert.equal(response.status, 200);
    assert.deepEqual(response.json, { ok: true });
  });
});

test("GET /ready delega para ReadinessService e preserva status saudavel", async () => {
  const readiness = {
    ok: true,
    checks: {
      database: { ok: true }
    }
  };

  patch(ReadinessService, "check", async () => readiness);

  await withServer(async (baseUrl) => {
    const response = await request(baseUrl, "/ready");

    assert.equal(response.status, 200);
    assert.deepEqual(response.json, readiness);
  });
});

test("GET /ready retorna 503 quando readiness falha", async () => {
  const readiness = {
    ok: false,
    checks: {
      database: { ok: false, message: "fora" }
    }
  };

  patch(ReadinessService, "check", async () => readiness);

  await withServer(async (baseUrl) => {
    const response = await request(baseUrl, "/ready");

    assert.equal(response.status, 503);
    assert.deepEqual(response.json, readiness);
  });
});

test("POST /auth/login retorna payload do UsuarioService", async () => {
  patch(UsuarioService, "login", async ({ email, senha }) => ({
    usuario: { id: 1, email },
    accessToken: `access:${senha}`,
    refreshToken: "refresh"
  }));

  await withServer(async (baseUrl) => {
    const response = await request(baseUrl, "/auth/login", {
      method: "POST",
      body: { email: "admin@orbis.local", senha: "123456" }
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.json, {
      usuario: { id: 1, email: "admin@orbis.local" },
      accessToken: "access:123456",
      refreshToken: "refresh"
    });
  });
});

test("rota protegida retorna 401 quando token nao foi enviado", async () => {
  await withServer(async (baseUrl) => {
    const response = await request(baseUrl, "/sensores");

    assert.equal(response.status, 401);
    assert.equal(typeof response.json.mensagem, "string");
    assert.equal(typeof response.json.requestId, "string");
  });
});

test("GET /sensores permite usuario autenticado e retorna sensores", async () => {
  mockAuthenticatedUsers();

  const sensores = [
    { id: 10, tipo: "temperatura", maquinaId: 3 },
    { id: 11, tipo: "vibracao", maquinaId: 3 }
  ];

  patch(SensorService, "list", async () => sensores);

  await withServer(async (baseUrl) => {
    const response = await request(baseUrl, "/sensores", {
      token: tokenFor({ id: 1, role: "ADMIN" })
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.json, sensores);
  });
});

test("POST /usuarios bloqueia tecnico em rota exclusiva de admin", async () => {
  mockAuthenticatedUsers();

  await withServer(async (baseUrl) => {
    const response = await request(baseUrl, "/usuarios", {
      method: "POST",
      token: tokenFor({ id: 2, role: "TECNICO" }),
      body: {
        nome: "Novo Usuario",
        email: "novo@orbis.local",
        senha: "123456",
        role: "TECNICO"
      }
    });

    assert.equal(response.status, 403);
    assert.equal(typeof response.json.mensagem, "string");
  });
});

test("PUT /usuarios/alterar-ativo permite tecnico alterar o proprio status", async () => {
  mockAuthenticatedUsers();

  patch(UsuarioService, "updateAtivo", async ({ id, ativo }) => ({
    id,
    ativo,
    message: "Status atualizado"
  }));

  await withServer(async (baseUrl) => {
    const response = await request(baseUrl, "/usuarios/alterar-ativo", {
      method: "PUT",
      token: tokenFor({ id: 2, role: "TECNICO" }),
      body: { ativo: false }
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.json, {
      id: 2,
      ativo: false,
      message: "Status atualizado"
    });
  });
});

test("GET /perfil retorna dados do usuario autenticado", async () => {
  mockAuthenticatedUsers();

  patch(PerfilService, "findPerfil", async (id) => ({
    id,
    nome: "Tecnico Orbis",
    role: "TECNICO"
  }));

  await withServer(async (baseUrl) => {
    const response = await request(baseUrl, "/perfil", {
      token: tokenFor({ id: 2, role: "TECNICO" })
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.json, {
      id: 2,
      nome: "Tecnico Orbis",
      role: "TECNICO"
    });
  });
});

test("PUT /perfil atualiza dados do proprio usuario", async () => {
  mockAuthenticatedUsers();

  patch(PerfilService, "updatePerfil", async ({ id, dados }) => ({
    id,
    ...dados
  }));

  await withServer(async (baseUrl) => {
    const response = await request(baseUrl, "/perfil", {
      method: "PUT",
      token: tokenFor({ id: 2, role: "TECNICO" }),
      body: {
        nome: "Tecnico Atualizado",
        telefone: "11999999999"
      }
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.json, {
      id: 2,
      nome: "Tecnico Atualizado",
      telefone: "11999999999"
    });
  });
});

test("POST /perfil/device-token e /perfil/push-teste usam usuario autenticado", async () => {
  mockAuthenticatedUsers();

  patch(PerfilService, "putOneSignalId", async ({ id, oneSignalId }) => ({
    id,
    oneSignalId
  }));
  patch(PerfilService, "sendPushTeste", async ({ id, title, message, data }) => ({
    id,
    title,
    message,
    data,
    sent: true
  }));

  await withServer(async (baseUrl) => {
    const token = tokenFor({ id: 2, role: "TECNICO" });
    const device = await request(baseUrl, "/perfil/device-token", {
      method: "POST",
      token,
      body: { oneSignalId: "player-1" }
    });
    const push = await request(baseUrl, "/perfil/push-teste", {
      method: "POST",
      token,
      body: { title: "Teste", message: "Mensagem", data: { origem: "contract" } }
    });

    assert.equal(device.status, 200);
    assert.deepEqual(device.json, { id: 2, oneSignalId: "player-1" });
    assert.equal(push.status, 200);
    assert.deepEqual(push.json, {
      id: 2,
      title: "Teste",
      message: "Mensagem",
      data: { origem: "contract" },
      sent: true
    });
  });
});

test("PUT /perfil/foto aceita multipart imagem e chama update de foto", async () => {
  mockAuthenticatedUsers();

  patch(PerfilService, "updateFotoPerfil", async ({ usuarioId, buffer }) => ({
    id: usuarioId,
    fotoPerfil: "https://storage/perfil.webp",
    tamanhoBytes: buffer.length
  }));

  const formData = new FormData();
  formData.append("imagem", createPngBlob(), "perfil.png");

  await withServer(async (baseUrl) => {
    const response = await request(baseUrl, "/perfil/foto", {
      method: "PUT",
      token: tokenFor({ id: 2, role: "TECNICO" }),
      body: formData
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.id, 2);
    assert.equal(response.json.fotoPerfil, "https://storage/perfil.webp");
    assert.equal(typeof response.json.tamanhoBytes, "number");
  });
});

test("DELETE /perfil/foto remove foto do usuario autenticado", async () => {
  mockAuthenticatedUsers();

  patch(PerfilService, "deleteFotoPerfil", async ({ usuarioId }) => ({
    id: usuarioId,
    fotoPerfil: null,
    caminhoFoto: null
  }));

  await withServer(async (baseUrl) => {
    const response = await request(baseUrl, "/perfil/foto", {
      method: "DELETE",
      token: tokenFor({ id: 2, role: "TECNICO" })
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.json, {
      id: 2,
      fotoPerfil: null,
      caminhoFoto: null
    });
  });
});

test("GET /maquinas retorna lista sanitizada para usuario autenticado", async () => {
  mockAuthenticatedUsers();

  const maquinas = [
    { id: 3, nome: "Prensa", manual: { textoExtraido: "privado" } }
  ];

  patch(MaquinaService, "list", async () => maquinas);
  patch(MaquinaService, "sanitizeForResponse", (value) => value);

  await withServer(async (baseUrl) => {
    const response = await request(baseUrl, "/maquinas", {
      token: tokenFor({ id: 1, role: "ADMIN" })
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.json, maquinas);
  });
});

test("POST /maquinas/manual/preview aceita multipart PDF e retorna especificacoes", async () => {
  mockAuthenticatedUsers();

  patch(MaquinaService, "previewManualSpecs", async ({ maquinaId, file }) => ({
    maquinaId,
    nomeArquivo: file.originalname,
    mimeType: file.mimetype,
    especificacoes: {
      temperaturaIdeal: 70
    }
  }));

  const formData = new FormData();
  formData.append("maquinaId", "4");
  formData.append("manual", createPdfBlob(), "manual.pdf");

  await withServer(async (baseUrl) => {
    const response = await request(baseUrl, "/maquinas/manual/preview", {
      method: "POST",
      token: tokenFor({ id: 1, role: "ADMIN" }),
      body: formData
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.json, {
      maquinaId: "4",
      nomeArquivo: "manual.pdf",
      mimeType: "application/pdf",
      especificacoes: {
        temperaturaIdeal: 70
      }
    });
  });
});

test("GET /maquinas/:id/predicao-alertas preserva estado preditivo explicito", async () => {
  mockAuthenticatedUsers();

  const predicao = {
    maquinaId: 9,
    estadoPredicao: "MANUTENCAO_IMEDIATA",
    fonteDecisao: "HEURISTICA_CRITICA",
    urgencia: "IMEDIATA",
    motivo: "integridade_abaixo_limiar_manutencao",
    proximoAlerta: null,
    ausenciaProximoAlerta: { motivo: "manutencao_imediata" },
    instabilidade: null,
    ausenciaInstabilidade: { motivo: "manutencao_imediata" },
    modeloIntegridade: {
      pontosUsados: 30,
      janelaHorasCoberta: 12,
      r2: 0.2,
      slope: -0.5
    }
  };

  patch(MaquinaService, "getPredicaoAlertas", async (id) => ({
    ...predicao,
    maquinaId: Number(id)
  }));

  await withServer(async (baseUrl) => {
    const response = await request(baseUrl, "/maquinas/9/predicao-alertas", {
      token: tokenFor({ id: 1, role: "ADMIN" })
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.json, predicao);
  });
});

test("GET /maquinas/:id/predicao-risco retorna classificacao de risco", async () => {
  mockAuthenticatedUsers();

  patch(MaquinaService, "getPredicaoRisco", async (id) => ({
    maquinaId: Number(id),
    risco: "ALTO",
    score: 82,
    motivos: ["integridade_critica"]
  }));

  await withServer(async (baseUrl) => {
    const response = await request(baseUrl, "/maquinas/4/predicao-risco", {
      token: tokenFor({ id: 1, role: "ADMIN" })
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.json, {
      maquinaId: 4,
      risco: "ALTO",
      score: 82,
      motivos: ["integridade_critica"]
    });
  });
});

test("GET /maquinas/:id/historico-integridade repassa id e query ao service", async () => {
  mockAuthenticatedUsers();

  patch(HistoricoIntegridadeService, "listByMaquina", async (maquinaId, query) => ({
    maquinaId: Number(maquinaId),
    query,
    historico: [{ id: 1, integridade: 74 }]
  }));

  await withServer(async (baseUrl) => {
    const response = await request(baseUrl, "/maquinas/8/historico-integridade?limit=5", {
      token: tokenFor({ id: 1, role: "ADMIN" })
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.json, {
      maquinaId: 8,
      query: { limit: "5" },
      historico: [{ id: 1, integridade: 74 }]
    });
  });
});

test("POST /leituras bloqueia integracao ESP32 sem x-api-key", async () => {
  await withServer(async (baseUrl) => {
    const response = await request(baseUrl, "/leituras", {
      method: "POST",
      body: { sensorId: 1, temperatura: 42, vibracao: 7 }
    });

    assert.equal(response.status, 401);
    assert.equal(typeof response.json.mensagem, "string");
  });
});

test("POST /leituras aceita x-api-key valida e cria leitura", async () => {
  patch(leituraService, "processarNovaLeitura", async (payload) => ({
    id: 20,
    ...payload,
    criadoEm: "2026-06-05T10:00:00.000Z"
  }));

  await withServer(async (baseUrl) => {
    const response = await request(baseUrl, "/leituras", {
      method: "POST",
      headers: { "x-api-key": process.env.ESP32_API_KEY },
      body: { sensorId: 1, temperatura: 42, vibracao: 7 }
    });

    assert.equal(response.status, 201);
    assert.deepEqual(response.json, {
      id: 20,
      sensorId: 1,
      temperatura: 42,
      vibracao: 7,
      criadoEm: "2026-06-05T10:00:00.000Z"
    });
  });
});

test("GET /leituras exige auth e retorna leituras em ordem reversa", async () => {
  mockAuthenticatedUsers();

  patch(leituraService, "index", async () => [
    { id: 1, sensorId: 1 },
    { id: 2, sensorId: 1 }
  ]);

  await withServer(async (baseUrl) => {
    const response = await request(baseUrl, "/leituras", {
      token: tokenFor({ id: 1, role: "ADMIN" })
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.json, [
      { id: 2, sensorId: 1 },
      { id: 1, sensorId: 1 }
    ]);
  });
});

test("GET /alertas/resumo agrega contadores operacionais", async () => {
  mockAuthenticatedUsers();

  patch(AlertaService, "countMaquinasWithAlerta", async () => 2);
  patch(AlertaService, "countActiveAlertas", async () => 5);
  patch(AlertaService, "countAlertasToday", async () => 3);
  patch(AlertaService, "countAlertaSemAtendimento", async () => 1);
  patch(AlertaService, "countAtendedToday", async () => 4);

  await withServer(async (baseUrl) => {
    const response = await request(baseUrl, "/alertas/resumo", {
      token: tokenFor({ id: 1, role: "ADMIN" })
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.json, {
      maquinasEmAlerta: 2,
      alertasAtivos: 5,
      alertasHoje: 3,
      alertaSemAtendimento: 1,
      alertasAtendidosHoje: 4
    });
  });
});

test("GET /alertas/:id/eventos retorna eventos do alerta autenticado", async () => {
  mockAuthenticatedUsers();

  patch(AlertaService, "findEventosByAlertaId", async (id) => [
    { id: 6, alertaId: Number(id), tipo: "CRIADO" }
  ]);

  await withServer(async (baseUrl) => {
    const response = await request(baseUrl, "/alertas/3/eventos", {
      token: tokenFor({ id: 1, role: "ADMIN" })
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.json, [{ id: 6, alertaId: 3, tipo: "CRIADO" }]);
  });
});

test("POST /alertas/:id/comentarios permite admin e tecnico, bloqueia visitante", async () => {
  mockAuthenticatedUsers();

  const chamadas = [];
  patch(AlertaService, "createComentario", async (payload) => {
    chamadas.push(payload);
    return {
      id: 31,
      alertaId: Number(payload.alertaId),
      usuarioId: payload.usuario.id,
      tipo: "COMENTARIO",
      mensagem: payload.mensagem,
      descricao: "Comentario adicionado"
    };
  });

  await withServer(async (baseUrl) => {
    const admin = await request(baseUrl, "/alertas/3/comentarios", {
      method: "POST",
      token: tokenFor({ id: 1, role: "ADMIN" }),
      body: { mensagem: "Comentario do admin" }
    });
    const tecnico = await request(baseUrl, "/alertas/3/comentarios", {
      method: "POST",
      token: tokenFor({ id: 2, role: "TECNICO" }),
      body: { mensagem: "Comentario do tecnico" }
    });
    const visitante = await request(baseUrl, "/alertas/3/comentarios", {
      method: "POST",
      token: tokenFor({ id: 3, role: "VISITANTE" }),
      body: { mensagem: "Comentario visitante" }
    });

    assert.equal(admin.status, 201);
    assert.deepEqual(admin.json, {
      id: 31,
      alertaId: 3,
      usuarioId: 1,
      tipo: "COMENTARIO",
      mensagem: "Comentario do admin",
      descricao: "Comentario adicionado"
    });
    assert.equal(tecnico.status, 201);
    assert.equal(tecnico.json.usuarioId, 2);
    assert.equal(visitante.status, 403);
    assert.deepEqual(chamadas.map((payload) => ({
      alertaId: payload.alertaId,
      usuarioId: payload.usuario.id,
      mensagem: payload.mensagem
    })), [
      { alertaId: "3", usuarioId: 1, mensagem: "Comentario do admin" },
      { alertaId: "3", usuarioId: 2, mensagem: "Comentario do tecnico" }
    ]);
  });
});

test("GET /manutencoes permite admin/visitante listar tudo e tecnico listar preventivas", async () => {
  mockAuthenticatedUsers();

  const chamadas = [];
  patch(ManutencaoService, "list", async ({ page, limit, usuario }) => {
    chamadas.push({ page, limit, usuarioId: usuario.id, role: usuario.role });
    return {
    page,
    limit,
    role: usuario.role,
    items: [{ id: 1, status: "EM_ANDAMENTO" }]
    };
  });

  await withServer(async (baseUrl) => {
    const tecnico = await request(baseUrl, "/manutencoes", {
      token: tokenFor({ id: 2, role: "TECNICO" })
    });
    const admin = await request(baseUrl, "/manutencoes?page=2&limit=10", {
      token: tokenFor({ id: 1, role: "ADMIN" })
    });
    const visitante = await request(baseUrl, "/manutencoes", {
      token: tokenFor({ id: 3, role: "VISITANTE" })
    });

    assert.equal(tecnico.status, 200);
    assert.equal(admin.status, 200);
    assert.equal(visitante.status, 200);
    assert.deepEqual(tecnico.json, {
      role: "TECNICO",
      items: [{ id: 1, status: "EM_ANDAMENTO" }]
    });
    assert.deepEqual(admin.json, {
      page: "2",
      limit: "10",
      role: "ADMIN",
      items: [{ id: 1, status: "EM_ANDAMENTO" }]
    });
    assert.deepEqual(chamadas.map((chamada) => ({
      usuarioId: chamada.usuarioId,
      role: chamada.role
    })), [
      { usuarioId: 2, role: "TECNICO" },
      { usuarioId: 1, role: "ADMIN" },
      { usuarioId: 3, role: "VISITANTE" }
    ]);
  });
});

test("POST /manutencoes permite tecnico criar manutencao corretiva ou preventiva com usuario autenticado", async () => {
  mockAuthenticatedUsers();

  patch(ManutencaoService, "create", async ({
    alertaId,
    maquinaId,
    tipo,
    titulo,
    prioridade,
    dataAgendada,
    usuarioId,
    observacao
  }) => ({
    id: 12,
    alertaId,
    maquinaId,
    tipo,
    titulo,
    prioridade,
    dataAgendada,
    usuarioId,
    observacao,
    status: "EM_ANDAMENTO"
  }));

  await withServer(async (baseUrl) => {
    const response = await request(baseUrl, "/manutencoes", {
      method: "POST",
      token: tokenFor({ id: 2, role: "TECNICO" }),
      body: { alertaId: 5, observacao: "Iniciando atendimento" }
    });

    assert.equal(response.status, 201);
    assert.deepEqual(response.json, {
      id: 12,
      alertaId: 5,
      usuarioId: 2,
      observacao: "Iniciando atendimento",
      status: "EM_ANDAMENTO"
    });

    const preventiva = await request(baseUrl, "/manutencoes", {
      method: "POST",
      token: tokenFor({ id: 2, role: "TECNICO" }),
      body: {
        tipo: "PREVENTIVA",
        maquinaId: 9,
        titulo: "Inspecao dos rolamentos",
        prioridade: "ALTA",
        dataAgendada: "2026-06-20T14:00:00.000Z",
        observacao: "Inspecao semanal"
      }
    });

    assert.equal(preventiva.status, 201);
    assert.deepEqual(preventiva.json, {
      id: 12,
      maquinaId: 9,
      tipo: "PREVENTIVA",
      titulo: "Inspecao dos rolamentos",
      prioridade: "ALTA",
      dataAgendada: "2026-06-20T14:00:00.000Z",
      usuarioId: 2,
      observacao: "Inspecao semanal",
      status: "EM_ANDAMENTO"
    });
  });
});

test("PUT /manutencoes/:id permite somente tecnico atualizar manutencao", async () => {
  mockAuthenticatedUsers();

  patch(ManutencaoService, "update", async (id, usuarioId, { dados }) => ({
    id: Number(id),
    usuarioId,
    ...dados
  }));

  await withServer(async (baseUrl) => {
    const admin = await request(baseUrl, "/manutencoes/12", {
      method: "PUT",
      token: tokenFor({ id: 1, role: "ADMIN" }),
      body: { status: "RESOLVIDO" }
    });
    const tecnico = await request(baseUrl, "/manutencoes/12", {
      method: "PUT",
      token: tokenFor({ id: 2, role: "TECNICO" }),
      body: { status: "RESOLVIDO" }
    });

    assert.equal(admin.status, 403);
    assert.equal(tecnico.status, 200);
    assert.deepEqual(tecnico.json, {
      id: 12,
      usuarioId: 2,
      status: "RESOLVIDO"
    });
  });
});

test("GET /dashboard/resumo permite admin e bloqueia tecnico", async () => {
  mockAuthenticatedUsers();

  const resumo = {
    totalMaquinas: 10,
    maquinasEmAlerta: 2,
    maquinasFuncionando: 8,
    alertasAtivos: 3,
    alertasHoje: 1,
    tecnicosAtivos: 4,
    integridadeMedia: 87,
    sensoresOnline: 12,
    alertaSemAtendimento: 1,
    alertasAtendidosHoje: 2
  };

  patch(DashboardService, "resume", async () => resumo);

  await withServer(async (baseUrl) => {
    const tecnico = await request(baseUrl, "/dashboard/resumo", {
      token: tokenFor({ id: 2, role: "TECNICO" })
    });
    const admin = await request(baseUrl, "/dashboard/resumo", {
      token: tokenFor({ id: 1, role: "ADMIN" })
    });

    assert.equal(tecnico.status, 403);
    assert.equal(admin.status, 200);
    assert.deepEqual(admin.json, resumo);
  });
});

test("rotas publicas de senha repassam payloads ao ResetSenhaService", async () => {
  patch(ResetSenhaService, "esqueceuSenha", async ({ email, emailDestino }) => ({
    email,
    emailDestino,
    message: "Se o usuario existir, o codigo sera enviado."
  }));
  patch(ResetSenhaService, "validarCodigo", async ({ email, code }) => ({
    email,
    code,
    message: "Codigo valido."
  }));
  patch(ResetSenhaService, "redefinirSenha", async ({ email, code, novaSenha }) => ({
    email,
    code,
    senhaLength: novaSenha.length,
    message: "Senha redefinida com sucesso."
  }));

  await withServer(async (baseUrl) => {
    const esqueci = await request(baseUrl, "/senha/esqueci-senha", {
      method: "POST",
      body: { email: "user@orbis.local", emailDestino: "destino@orbis.local" }
    });
    const validar = await request(baseUrl, "/senha/validar-codigo", {
      method: "POST",
      body: { email: "user@orbis.local", code: "123456" }
    });
    const redefinir = await request(baseUrl, "/senha/redefinir-senha", {
      method: "POST",
      body: { email: "user@orbis.local", code: "123456", novaSenha: "nova-senha" }
    });

    assert.equal(esqueci.status, 200);
    assert.deepEqual(esqueci.json, {
      email: "user@orbis.local",
      emailDestino: "destino@orbis.local",
      message: "Se o usuario existir, o codigo sera enviado."
    });
    assert.equal(validar.status, 200);
    assert.deepEqual(validar.json, {
      email: "user@orbis.local",
      code: "123456",
      message: "Codigo valido."
    });
    assert.equal(redefinir.status, 200);
    assert.deepEqual(redefinir.json, {
      email: "user@orbis.local",
      code: "123456",
      senhaLength: 10,
      message: "Senha redefinida com sucesso."
    });
  });
});

test("rotas autenticadas de senha usam id do usuario logado", async () => {
  mockAuthenticatedUsers();

  patch(ResetSenhaService, "solicitarAlteracao", async ({ id, senhaAtual, emailDestino }) => ({
    id,
    senhaAtual,
    emailDestino,
    message: "Codigo enviado"
  }));
  patch(ResetSenhaService, "confirmarAlteracao", async ({ id, code, novaSenha }) => ({
    id,
    code,
    senhaLength: novaSenha.length,
    message: "Senha alterada"
  }));

  await withServer(async (baseUrl) => {
    const token = tokenFor({ id: 2, role: "TECNICO" });
    const solicitar = await request(baseUrl, "/senha/solicitar-alteracao", {
      method: "POST",
      token,
      body: { senhaAtual: "atual", emailDestino: "destino@orbis.local" }
    });
    const confirmar = await request(baseUrl, "/senha/confirmar-alteracao", {
      method: "POST",
      token,
      body: { code: "123456", novaSenha: "nova-senha" }
    });

    assert.equal(solicitar.status, 200);
    assert.deepEqual(solicitar.json, {
      id: 2,
      senhaAtual: "atual",
      emailDestino: "destino@orbis.local",
      message: "Codigo enviado"
    });
    assert.equal(confirmar.status, 200);
    assert.deepEqual(confirmar.json, {
      id: 2,
      code: "123456",
      senhaLength: 10,
      message: "Senha alterada"
    });
  });
});

test("POST /relatorios/preview usa usuario autenticado e retorna preview", async () => {
  mockAuthenticatedUsers();

  patch(RelatorioAgendamentoService, "preview", async ({ usuario, payload }) => ({
    usuarioId: usuario.id,
    preview: {
      nome: payload.nome,
      periodo: payload.periodo,
      secoes: []
    }
  }));

  await withServer(async (baseUrl) => {
    const response = await request(baseUrl, "/relatorios/preview", {
      method: "POST",
      token: tokenFor({ id: 1, role: "ADMIN" }),
      body: {
        nome: "Resumo diario",
        assunto: "Resumo",
        periodo: "diario",
        filtros: {}
      }
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.json, {
      usuarioId: 1,
      preview: {
        nome: "Resumo diario",
        periodo: "diario",
        secoes: []
      }
    });
  });
});

test("GET /relatorios/agendamentos/:id/execucoes preserva contrato de listagem", async () => {
  mockAuthenticatedUsers();

  patch(RelatorioExecucaoService, "listExecutions", async ({ id, usuario }) => ({
    agendamentoId: Number(id),
    usuarioId: usuario.id,
    execucoes: [{ id: 9, status: "SUCESSO" }]
  }));

  await withServer(async (baseUrl) => {
    const response = await request(baseUrl, "/relatorios/agendamentos/7/execucoes", {
      token: tokenFor({ id: 1, role: "ADMIN" })
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.json, {
      agendamentoId: 7,
      usuarioId: 1,
      execucoes: [{ id: 9, status: "SUCESSO" }]
    });
  });
});

test("POST /dashboard/ia/perguntar retorna resposta da IA autenticada", async () => {
  mockAuthenticatedUsers();

  patch(DashboardAiService, "answer", async ({ pergunta, usuario }) => ({
    pergunta,
    usuarioId: usuario.id,
    resposta: "Panorama gerado",
    fallback: false,
    usedHistoryCount: 0
  }));

  await withServer(async (baseUrl) => {
    const response = await request(baseUrl, "/dashboard/ia/perguntar", {
      method: "POST",
      token: tokenFor({ id: 1, role: "ADMIN" }),
      body: {
        pergunta: "Me de um panorama",
        historico: []
      }
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.json, {
      pergunta: "Me de um panorama",
      usuarioId: 1,
      resposta: "Panorama gerado",
      fallback: false,
      usedHistoryCount: 0
    });
  });
});

test("POST /email normaliza payload valido e retorna sucesso publico", async () => {
  patch(ContatoService, "enviarContato", async (payload) => ({
    id: "email-1",
    destinatario: payload.email
  }));

  await withServer(async (baseUrl) => {
    const response = await request(baseUrl, "/email", {
      method: "POST",
      body: {
        nome: "  Gustavo  ",
        email: "GUSTAVO@EXAMPLE.COM",
        assunto: "Contato Orbis",
        mensagem: "Mensagem valida para contato."
      }
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.json, {
      message: "Mensagem enviada com sucesso.",
      id: "email-1",
      destinatario: "gustavo@example.com"
    });
  });
});
