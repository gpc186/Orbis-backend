const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");

const prisma = require("../../../src/prisma/prisma");
const MaquinaModel = require("../../../src/models/maquinaModel");
const SensorModel = require("../../../src/models/sensorModel");
const UsuarioModel = require("../../../src/models/usuarioModel");
const RelatorioAgendamentoModel = require("../../../src/models/relatorioAgendamentoModel");
const AlertaModel = require("../../../src/models/alertaModel");

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

test("MaquinaModel.create cria historico inicial dentro da transacao", async () => {
  const historicoPayloads = [];
  const maquinaCriada = {
    id: 9,
    nome: "Prensa",
    integridade: 100,
    scoreEstabilidade: 100
  };

  patch(prisma, "$transaction", async (callback) => callback({
    maquina: {
      create: async (payload) => {
        assert.deepEqual(payload, {
          data: { nome: "Prensa", tipo: "Hidraulica" },
          include: { manual: true }
        });
        return maquinaCriada;
      }
    },
    historicoIntegridade: {
      create: async (payload) => {
        historicoPayloads.push(payload);
      }
    }
  }));

  const result = await MaquinaModel.create({ nome: "Prensa", tipo: "Hidraulica" });

  assert.equal(result, maquinaCriada);
  assert.deepEqual(historicoPayloads, [{
    data: {
      maquinaId: 9,
      integridade: 100,
      scoreEstabilidade: 100,
      origem: "CADASTRO_MAQUINA",
      observacao: "Registro inicial de integridade."
    }
  }]);
});

test("MaquinaModel.update registra historico apenas quando saude muda", async () => {
  const historicos = [];
  const updates = [];

  patch(prisma, "$transaction", async (callback) => callback({
    maquina: {
      update: async (payload) => {
        updates.push(payload);
        return {
          id: payload.where.id,
          integridade: payload.data.integridade ?? 90,
          scoreEstabilidade: payload.data.scoreEstabilidade ?? 80
        };
      }
    },
    historicoIntegridade: {
      create: async (payload) => {
        historicos.push(payload);
      }
    }
  }));

  await MaquinaModel.update("4", { nome: "Sem historico" });
  await MaquinaModel.update("4", { integridade: 88 });

  assert.deepEqual(updates.map((payload) => payload.where), [{ id: 4 }, { id: 4 }]);
  assert.equal(historicos.length, 1);
  assert.deepEqual(historicos[0], {
    data: {
      maquinaId: 4,
      integridade: 88,
      scoreEstabilidade: 80,
      origem: "ATUALIZACAO_MAQUINA"
    }
  });
});

test("SensorModel.create normaliza numeros e conecta maquina", async () => {
  let receivedPayload = null;

  patch(prisma.sensor, "create", async (payload) => {
    receivedPayload = payload;
    return { id: 1 };
  });

  await SensorModel.create({
    tipo: "temperatura",
    maquinaId: "3",
    limiteTemperatura: "90.5",
    idealTemperatura: "70",
    limiteVibracao: "12.3",
    idealVibracao: "4.5",
    desvioMaximoTemp: "10",
    desvioMaximoVibra: "2",
    status: "ONLINE"
  });

  assert.deepEqual(receivedPayload, {
    data: {
      tipo: "temperatura",
      limiteTemperatura: 90.5,
      idealTemperatura: 70,
      limiteVibracao: 12.3,
      idealVibracao: 4.5,
      maquina: {
        connect: { id: 3 }
      },
      status: "ONLINE",
      desvioMaximoTemp: 10,
      desvioMaximoVibra: 2
    }
  });
});

test("SensorModel.updateStatus marca sensores vencidos como OFFLINE sem tocar INATIVO/OFFLINE", async () => {
  const limite = new Date("2026-06-05T10:00:00.000Z");
  let receivedPayload = null;

  patch(prisma.sensor, "updateMany", async (payload) => {
    receivedPayload = payload;
    return { count: 2 };
  });

  const result = await SensorModel.updateStatus(limite);

  assert.deepEqual(result, { count: 2 });
  assert.deepEqual(receivedPayload, {
    where: {
      AND: [
        { status: { notIn: ["INATIVO", "OFFLINE"] } },
        {
          OR: [
            { ultimaLeituraEm: { lt: limite } },
            { ultimaLeituraEm: null }
          ]
        }
      ]
    },
    data: { status: "OFFLINE" }
  });
});

test("UsuarioModel.findByNome aplica filtros opcionais e select sem senha", async () => {
  let receivedPayload = null;

  patch(prisma.usuario, "findMany", async (payload) => {
    receivedPayload = payload;
    return [];
  });

  await UsuarioModel.findByNome({
    nome: "Carlos",
    take: 7,
    ativo: true,
    role: "TECNICO"
  });

  assert.deepEqual(receivedPayload.where, {
    nome: {
      contains: "Carlos",
      mode: "insensitive"
    },
    ativo: true,
    role: "TECNICO"
  });
  assert.equal(receivedPayload.take, 7);
  assert.equal(receivedPayload.orderBy.nome, "asc");
  assert.equal(receivedPayload.select.senha, undefined);
  assert.equal(receivedPayload.select.email, true);
});

test("RelatorioAgendamentoModel.listDue busca ativos vencidos e locks expirados", async () => {
  const referenceDate = new Date("2026-06-05T12:00:00.000Z");
  let receivedPayload = null;

  patch(prisma.relatorioAgendamento, "findMany", async (payload) => {
    receivedPayload = payload;
    return [];
  });

  await RelatorioAgendamentoModel.listDue(referenceDate, 15);

  assert.equal(receivedPayload.where.status, "ATIVO");
  assert.deepEqual(receivedPayload.where.proximoEnvioEm, { lte: referenceDate });
  assert.equal(receivedPayload.where.OR[0].lockedAt, null);
  assert.equal(receivedPayload.where.OR[1].lockedAt.lt.toISOString(), "2026-06-05T11:50:00.000Z");
  assert.equal(receivedPayload.take, 15);
  assert.deepEqual(receivedPayload.orderBy, { proximoEnvioEm: "asc" });
  assert.deepEqual(receivedPayload.include, RelatorioAgendamentoModel.baseInclude());
});

test("RelatorioAgendamentoModel.update recria destinatarios quando lista de emails e enviada", async () => {
  const operations = [];

  patch(prisma, "$transaction", async (callback) => callback({
    relatorioDestinatario: {
      deleteMany: async (payload) => operations.push({ op: "deleteMany", payload })
    },
    relatorioAgendamento: {
      update: async (payload) => {
        operations.push({ op: "update", payload });
        return { id: payload.where.id };
      }
    }
  }));

  const result = await RelatorioAgendamentoModel.update({
    id: "8",
    data: { nome: "Semanal" },
    emailsDestino: ["b@orbis.local", "a@orbis.local"]
  });

  assert.deepEqual(result, { id: 8 });
  assert.deepEqual(operations, [
    {
      op: "deleteMany",
      payload: { where: { agendamentoId: 8 } }
    },
    {
      op: "update",
      payload: {
        where: { id: 8 },
        data: {
          nome: "Semanal",
          destinatarios: {
            create: [
              { email: "b@orbis.local" },
              { email: "a@orbis.local" }
            ]
          }
        },
        include: RelatorioAgendamentoModel.baseInclude()
      }
    }
  ]);
});

test("AlertaModel.create cria evento inicial na mesma transacao", async () => {
  const events = [];
  const alertaCriado = { id: 12, sensorId: 2, maquinaId: 5 };

  patch(prisma, "$transaction", async (callback) => callback({
    alerta: {
      create: async (payload) => {
        assert.deepEqual(payload, {
          data: {
            sensorId: 2,
            maquinaId: 5,
            tipo: "LIMITE_ULTRAPASSADO",
            mensagem: "Temperatura alta",
            status: "ATIVO"
          }
        });
        return alertaCriado;
      }
    },
    alertaEvento: {
      create: async (payload) => events.push(payload)
    }
  }));

  const result = await AlertaModel.create(2, 5, "LIMITE_ULTRAPASSADO", "Temperatura alta");

  assert.equal(result, alertaCriado);
  assert.deepEqual(events, [{
    data: {
      alertaId: 12,
      tipo: "CRIADO",
      statusNovo: "ATIVO",
      mensagem: "Temperatura alta",
      descricao: "Alerta criado automaticamente"
    }
  }]);
});

test("AlertaModel.findByMaquinaPeriodo monta filtros opcionais de periodo, tipos e status", async () => {
  let receivedPayload = null;

  patch(prisma.alerta, "findMany", async (payload) => {
    receivedPayload = payload;
    return [];
  });

  await AlertaModel.findByMaquinaPeriodo("7", {
    dataInicio: "2026-06-01T00:00:00.000Z",
    dataFim: "2026-06-05T00:00:00.000Z",
    tipos: ["TENDENCIA_CURTA"],
    statuses: ["ATIVO", "RESOLVIDO"]
  });

  assert.equal(receivedPayload.where.maquinaId, 7);
  assert.equal(receivedPayload.where.criadoEm.gte.toISOString(), "2026-06-01T00:00:00.000Z");
  assert.equal(receivedPayload.where.criadoEm.lte.toISOString(), "2026-06-05T00:00:00.000Z");
  assert.deepEqual(receivedPayload.where.tipo, { in: ["TENDENCIA_CURTA"] });
  assert.deepEqual(receivedPayload.where.status, { in: ["ATIVO", "RESOLVIDO"] });
  assert.deepEqual(receivedPayload.orderBy, { criadoEm: "desc" });
});
