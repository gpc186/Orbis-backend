const assert = require("node:assert/strict");
const test = require("node:test");

const RelatorioAgendamentoModel = require("../../../src/models/relatorioAgendamentoModel");
const RelatorioRendererService = require("../../../src/services/relatorioRendererService");
const RelatorioExecucaoService = require("../../../src/services/relatorioExecucaoService");
const RelatorioAgendamentoService = require("../../../src/services/relatorioAgendamentoService");
const AppError = require("../../../src/utils/appErrorUtils");

function patchMethods(target, methods) {
  const originals = {};

  for (const [key, value] of Object.entries(methods)) {
    originals[key] = target[key];
    target[key] = value;
  }

  return () => {
    for (const [key, value] of Object.entries(originals)) {
      target[key] = value;
    }
  };
}

function expectAppError({ statusCode, message }) {
  return (error) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.statusCode, statusCode);
    if (message) assert.equal(error.message, message);
    return true;
  };
}

function admin() {
  return { id: 1, role: "ADMIN" };
}

function tecnico() {
  return { id: 2, role: "TECNICO" };
}

function validPayload(overrides = {}) {
  return {
    nome: "Resumo semanal",
    assunto: "Resumo Orbis",
    emailsDestino: ["GESTAO@ORBIS.COM", "gestao@orbis.com", "ops@orbis.com"],
    periodo: { tipo: "RELATIVE_DAYS", valor: 7 },
    filtros: {
      maquinasIds: [1, "2", "x"],
      sensoresIds: [3],
      usuariosIds: [4],
      secoes: ["resumo", "sensores"]
    },
    agendamento: {
      frequencia: "DIARIO",
      hora: 8,
      minuto: 30
    },
    ...overrides
  };
}

function agendamento(overrides = {}) {
  return {
    id: 10,
    nome: "Resumo semanal",
    criadoPorId: 1,
    status: "ATIVO",
    frequencia: "DIARIO",
    hora: 8,
    minuto: 30,
    diaSemana: null,
    diaMes: null,
    assunto: "Resumo Orbis",
    tipoPeriodo: "RELATIVE_DAYS",
    periodo: { tipo: "RELATIVE_DAYS", valor: 7 },
    filtros: { secoes: ["resumo"] },
    secoes: ["resumo"],
    proximoEnvioEm: new Date("2026-06-05T11:30:00.000Z"),
    ultimoEnvioEm: null,
    ultimoSucessoEm: null,
    criadoEm: new Date("2026-06-01T10:00:00.000Z"),
    atualizadoEm: new Date("2026-06-01T10:00:00.000Z"),
    destinatarios: [{ email: "gestao@orbis.com" }],
    criadoPor: { id: 1, nome: "Admin", email: "admin@orbis.com", role: "ADMIN" },
    ...overrides
  };
}

test("preview exige admin, valida payload e retorna renderizacao publica", async () => {
  const restoreRenderer = patchMethods(RelatorioRendererService, {
    render: async (payload) => {
      assert.deepEqual(payload, {
        nome: "Relatorio Operacional",
        assunto: "Preview Orbis",
        periodo: { tipo: "RELATIVE_DAYS", valor: 15 },
        filtros: {
          maquinasIds: [],
          sensoresIds: [],
          usuariosIds: [],
          secoes: ["resumo", "desempenho", "sensores", "chamados", "historicoTendencia"]
        }
      });

      return {
        subject: "Preview Orbis",
        html: "<html></html>",
        periodoLabel: "Ultimos 15 dias",
        data: { total: 1 },
        ignored: "nao deve sair"
      };
    }
  });

  try {
    await assert.rejects(
      () => RelatorioAgendamentoService.preview({
        usuario: tecnico(),
        payload: { periodo: { tipo: "RELATIVE_DAYS", valor: 15 } }
      }),
      expectAppError({ statusCode: 403, message: "Apenas ADMIN pode gerenciar relatorios." })
    );

    const result = await RelatorioAgendamentoService.preview({
      usuario: admin(),
      payload: {
        assunto: "Preview Orbis",
        periodo: { tipo: "RELATIVE_DAYS", valor: 15 }
      }
    });

    assert.deepEqual(result, {
      subject: "Preview Orbis",
      html: "<html></html>",
      periodoLabel: "Ultimos 15 dias",
      data: { total: 1 }
    });
  } finally {
    restoreRenderer();
  }
});

test("create normaliza payload, calcula proximo envio e mapeia resposta", async () => {
  let capturedCreate;
  const restoreModel = patchMethods(RelatorioAgendamentoModel, {
    create: async (args) => {
      capturedCreate = args;
      assert.ok(args.data.proximoEnvioEm instanceof Date);
      return agendamento({
        ...args.data,
        destinatarios: args.emailsDestino.map((email) => ({ email }))
      });
    }
  });

  try {
    const result = await RelatorioAgendamentoService.create({
      usuario: admin(),
      payload: validPayload()
    });

    assert.equal(capturedCreate.data.nome, "Resumo semanal");
    assert.equal(capturedCreate.data.criadoPorId, 1);
    assert.equal(capturedCreate.data.status, "ATIVO");
    assert.equal(capturedCreate.data.frequencia, "DIARIO");
    assert.equal(capturedCreate.data.hora, 8);
    assert.equal(capturedCreate.data.minuto, 30);
    assert.deepEqual(capturedCreate.data.filtros, {
      maquinasIds: [1, 2],
      sensoresIds: [3],
      usuariosIds: [4],
      secoes: ["resumo", "sensores"]
    });
    assert.deepEqual(capturedCreate.emailsDestino, ["gestao@orbis.com", "ops@orbis.com"]);
    assert.equal(result.descricaoAgendamento, "Diario as 08:30");
    assert.equal(result.proximoEnvioEm.includes("T"), true);
  } finally {
    restoreModel();
  }
});

test("list, findById e findByDestinatarioEmail exigem admin e mapeiam resultados", async () => {
  const restoreModel = patchMethods(RelatorioAgendamentoModel, {
    findAll: async () => [agendamento({ id: 1 }), agendamento({ id: 2 })],
    findById: async (id) => (Number(id) === 404 ? null : agendamento({ id: Number(id) })),
    findByDestinatarioEmail: async ({ email, limit }) => {
      assert.equal(email, "gestao");
      assert.equal(limit, 10);
      return [agendamento({ id: 3 })];
    }
  });

  try {
    await assert.rejects(
      () => RelatorioAgendamentoService.list({ usuario: tecnico() }),
      expectAppError({ statusCode: 403 })
    );

    const list = await RelatorioAgendamentoService.list({ usuario: admin() });
    assert.deepEqual(list.map((item) => item.id), [1, 2]);
    assert.equal(list[0].descricaoAgendamento, "Diario as 08:30");

    assert.equal((await RelatorioAgendamentoService.findById({ usuario: admin(), id: 7 })).id, 7);
    await assert.rejects(
      () => RelatorioAgendamentoService.findById({ usuario: admin(), id: 404 }),
      expectAppError({ statusCode: 404, message: "Agendamento de relatorio nao encontrado." })
    );

    await assert.rejects(
      () => RelatorioAgendamentoService.findByDestinatarioEmail({
        usuario: admin(),
        email: "ab"
      }),
      expectAppError({ statusCode: 400 })
    );

    const byEmail = await RelatorioAgendamentoService.findByDestinatarioEmail({
      usuario: admin(),
      email: " gestao ",
      limit: 99
    });
    assert.deepEqual(byEmail.map((item) => item.id), [3]);
  } finally {
    restoreModel();
  }
});

test("update preserva status pausado e atualiza dados normalizados", async () => {
  let capturedUpdate;
  const restoreModel = patchMethods(RelatorioAgendamentoModel, {
    findById: async (id) => (Number(id) === 404 ? null : agendamento({ id: Number(id), status: "PAUSADO" })),
    update: async (args) => {
      capturedUpdate = args;
      assert.ok(args.data.proximoEnvioEm instanceof Date);
      return agendamento({
        id: Number(args.id),
        ...args.data,
        destinatarios: args.emailsDestino.map((email) => ({ email }))
      });
    }
  });

  try {
    await assert.rejects(
      () => RelatorioAgendamentoService.update({ usuario: admin(), id: 404, payload: validPayload() }),
      expectAppError({ statusCode: 404, message: "Agendamento de relatorio nao encontrado." })
    );

    const result = await RelatorioAgendamentoService.update({
      usuario: admin(),
      id: 10,
      payload: validPayload({
        agendamento: {
          frequencia: "SEMANAL",
          hora: 9,
          minuto: 15,
          diaSemana: 2
        }
      })
    });

    assert.equal(capturedUpdate.id, 10);
    assert.equal(capturedUpdate.data.status, "PAUSADO");
    assert.equal(capturedUpdate.data.frequencia, "SEMANAL");
    assert.equal(capturedUpdate.data.diaSemana, 2);
    assert.equal(capturedUpdate.data.diaMes, null);
    assert.deepEqual(capturedUpdate.emailsDestino, ["gestao@orbis.com", "ops@orbis.com"]);
    assert.equal(result.descricaoAgendamento, "Semanal toda Terca as 09:15");
  } finally {
    restoreModel();
  }
});

test("updateStatus pausa sem recalcular e ativa recalculando proximo envio", async () => {
  const updates = [];
  const restoreModel = patchMethods(RelatorioAgendamentoModel, {
    findById: async (id) => (Number(id) === 404 ? null : agendamento({ id: Number(id) })),
    updateStatus: async (id, data) => {
      updates.push({ id, data });
      return agendamento({ id: Number(id), ...data });
    }
  });

  try {
    await assert.rejects(
      () => RelatorioAgendamentoService.updateStatus({ usuario: admin(), id: 10, payload: { status: "INVALIDO" } }),
      expectAppError({ statusCode: 400, message: "Status do agendamento invalido." })
    );
    await assert.rejects(
      () => RelatorioAgendamentoService.updateStatus({ usuario: admin(), id: 404, payload: { status: "ATIVO" } }),
      expectAppError({ statusCode: 404, message: "Agendamento de relatorio nao encontrado." })
    );

    await RelatorioAgendamentoService.updateStatus({
      usuario: admin(),
      id: 10,
      payload: { status: "pausado" }
    });
    await RelatorioAgendamentoService.updateStatus({
      usuario: admin(),
      id: 10,
      payload: { status: "ATIVO" }
    });

    assert.deepEqual(updates[0], {
      id: 10,
      data: {
        status: "PAUSADO",
        lockedAt: null
      }
    });
    assert.equal(updates[1].id, 10);
    assert.equal(updates[1].data.status, "ATIVO");
    assert.equal(updates[1].data.lockedAt, null);
    assert.equal(updates[1].data.ultimoErroEm, null);
    assert.ok(updates[1].data.proximoEnvioEm instanceof Date);
  } finally {
    restoreModel();
  }
});

test("delete valida existencia e retorna id/nome removido", async () => {
  const deleted = [];
  const restoreModel = patchMethods(RelatorioAgendamentoModel, {
    findById: async (id) => (Number(id) === 404 ? null : agendamento({ id: Number(id), nome: "Diario" })),
    delete: async (id) => deleted.push(id)
  });

  try {
    await assert.rejects(
      () => RelatorioAgendamentoService.delete({ usuario: admin(), id: 404 }),
      expectAppError({ statusCode: 404, message: "Agendamento de relatorio nao encontrado." })
    );

    assert.deepEqual(await RelatorioAgendamentoService.delete({ usuario: admin(), id: "10" }), {
      id: 10,
      nome: "Diario"
    });
    assert.deepEqual(deleted, ["10"]);
  } finally {
    restoreModel();
  }
});

test("executeNow exige admin e delega execucao manual sem atualizar agendamento", async () => {
  let capturedArgs;
  const restoreExecucao = patchMethods(RelatorioExecucaoService, {
    executarAgendamento: async (id, options) => {
      capturedArgs = { id, options };
      return { id: 99, status: "ENVIADO" };
    }
  });

  try {
    await assert.rejects(
      () => RelatorioAgendamentoService.executeNow({ usuario: tecnico(), id: 10 }),
      expectAppError({ statusCode: 403, message: "Apenas ADMIN pode gerenciar relatorios." })
    );

    assert.deepEqual(await RelatorioAgendamentoService.executeNow({ usuario: admin(), id: 10 }), {
      id: 99,
      status: "ENVIADO"
    });
    assert.deepEqual(capturedArgs, {
      id: 10,
      options: {
        updateSchedule: false,
        tipoExecucao: "MANUAL"
      }
    });
  } finally {
    restoreExecucao();
  }
});

test("processDueSchedules ignora lock perdido, registra sucesso/falha e sempre limpa lock adquirido", async () => {
  const cleared = [];
  const restoreModel = patchMethods(RelatorioAgendamentoModel, {
    listDue: async (referenceDate) => {
      assert.ok(referenceDate instanceof Date);
      return [{ id: 1 }, { id: 2 }, { id: 3 }];
    },
    tryLock: async (id, lockedAt) => {
      assert.ok(lockedAt instanceof Date);
      return id !== 1;
    },
    clearLock: async (id) => cleared.push(id)
  });
  const restoreExecucao = patchMethods(RelatorioExecucaoService, {
    executarAgendamento: async (id) => {
      if (id === 3) throw new Error("envio falhou");
      return { execucaoId: id * 10 };
    }
  });

  try {
    const processed = await RelatorioAgendamentoService.processDueSchedules();

    assert.deepEqual(processed, [
      {
        agendamentoId: 2,
        status: "ENVIADO",
        result: { execucaoId: 20 }
      },
      {
        agendamentoId: 3,
        status: "FALHOU",
        error: "envio falhou"
      }
    ]);
    assert.deepEqual(cleared, [2, 3]);
  } finally {
    restoreExecucao();
    restoreModel();
  }
});
