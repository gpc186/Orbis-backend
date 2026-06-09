const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");

const AlertaService = require("../../../src/services/alertaService");
const OneSignalService = require("../../../src/services/oneSignalService");
const AlertaModel = require("../../../src/models/alertaModel");
const MaquinaModel = require("../../../src/models/maquinaModel");
const UsuarioModel = require("../../../src/models/usuarioModel");

const originals = {
  findAtivo: AlertaModel.findAtivo,
  update: AlertaModel.update,
  create: AlertaModel.create,
  findById: AlertaModel.findById,
  findAll: AlertaModel.findAll,
  findEventosByAlertaId: AlertaModel.findEventosByAlertaId,
  findAtivos: AlertaModel.findAtivos,
  findByMaquinaId: AlertaModel.findByMaquinaId,
  findOpenForSla: AlertaModel.findOpenForSla,
  countActiveAlertas: AlertaModel.countActiveAlertas,
  maquinaFindById: MaquinaModel.findById,
  usuarioFindNotificationRecipients: UsuarioModel.findNotificationRecipients,
  sendToOneSignalIds: OneSignalService.sendToOneSignalIds,
  notificarNovoAlerta: AlertaService.notificarNovoAlerta
};

afterEach(() => {
  AlertaModel.findAtivo = originals.findAtivo;
  AlertaModel.update = originals.update;
  AlertaModel.create = originals.create;
  AlertaModel.findById = originals.findById;
  AlertaModel.findAll = originals.findAll;
  AlertaModel.findEventosByAlertaId = originals.findEventosByAlertaId;
  AlertaModel.findAtivos = originals.findAtivos;
  AlertaModel.findByMaquinaId = originals.findByMaquinaId;
  AlertaModel.findOpenForSla = originals.findOpenForSla;
  AlertaModel.countActiveAlertas = originals.countActiveAlertas;
  MaquinaModel.findById = originals.maquinaFindById;
  UsuarioModel.findNotificationRecipients = originals.usuarioFindNotificationRecipients;
  OneSignalService.sendToOneSignalIds = originals.sendToOneSignalIds;
  AlertaService.notificarNovoAlerta = originals.notificarNovoAlerta;
});

test("gerarAlerta atualiza alerta ativo existente em vez de criar duplicado", async () => {
  AlertaModel.findAtivo = async () => ({ id: 3, status: "ATIVO" });

  let updatePayload;
  AlertaModel.update = async (id, dados) => {
    updatePayload = { id, dados };
    return { id, ...dados };
  };

  AlertaModel.create = async () => {
    throw new Error("nao deveria criar alerta duplicado");
  };
  AlertaService.notificarNovoAlerta = async () => {
    throw new Error("nao deveria notificar alerta repetido");
  };

  const result = await AlertaService.gerarAlerta(1, 2, "INSTABILIDADE", "Nova oscilacao");

  assert.equal(result.id, 3);
  assert.equal(updatePayload.id, 3);
  assert.match(updatePayload.dados.mensagem, /Nova oscilacao/);
  assert.deepEqual(updatePayload.dados.eventos.create, {
    tipo: "ATUALIZADO",
    statusAnterior: "ATIVO",
    statusNovo: "ATIVO",
    mensagem: "Nova oscilacao",
    descricao: "Limite ultrapassado novamente"
  });
});

test("gerarAlerta cria alerta novo e nao falha quando notificacao push falha", async () => {
  AlertaModel.findAtivo = async () => null;
  AlertaModel.create = async (sensorId, maquinaId, tipo, mensagem) => ({
    id: 9,
    sensorId,
    maquinaId,
    tipo,
    mensagem
  });
  AlertaService.notificarNovoAlerta = async () => {
    throw new Error("push indisponivel");
  };

  const result = await AlertaService.gerarAlerta(1, 2, "LIMITE_ULTRAPASSADO", "Temperatura alta");

  assert.deepEqual(result, {
    id: 9,
    sensorId: 1,
    maquinaId: 2,
    tipo: "LIMITE_ULTRAPASSADO",
    mensagem: "Temperatura alta"
  });
});

test("notificarNovoAlerta envia push para destinatarios unicos com OneSignalId", async () => {
  AlertaModel.findById = async () => ({
    id: 10,
    maquinaId: 4,
    sensorId: 8,
    tipo: "INSTABILIDADE"
  });
  MaquinaModel.findById = async () => ({ id: 4, nome: "Prensa Hidraulica" });
  UsuarioModel.findNotificationRecipients = async () => [
    { id: 1, ativo: true, oneSignalId: "player-1" },
    { id: 2, ativo: true, oneSignalId: "player-1" },
    { id: 3, ativo: true, oneSignalId: "player-2" },
    { id: 4, ativo: false, oneSignalId: "player-3" }
  ];

  let pushPayload;
  OneSignalService.sendToOneSignalIds = async (payload) => {
    pushPayload = payload;
  };

  await AlertaService.notificarNovoAlerta(10);

  assert.deepEqual(pushPayload.oneSignalIds, ["player-1", "player-2"]);
  assert.equal(pushPayload.title, "Novo alerta");
  assert.match(pushPayload.message, /Prensa Hidraulica/);
  assert.deepEqual(pushPayload.data, {
    tipo: "novo_alerta",
    alertaId: 10,
    maquinaId: 4,
    sensorId: 8
  });
});

test("notificarNovoAlerta pula envio quando alerta, maquina ou destinatarios nao existem", async () => {
  let pushChamado = false;
  OneSignalService.sendToOneSignalIds = async () => {
    pushChamado = true;
  };

  AlertaModel.findById = async () => null;
  await AlertaService.notificarNovoAlerta(1);

  AlertaModel.findById = async () => ({ id: 1, maquinaId: 2 });
  MaquinaModel.findById = async () => null;
  await AlertaService.notificarNovoAlerta(1);

  MaquinaModel.findById = async () => ({ id: 2, nome: "Motor" });
  UsuarioModel.findNotificationRecipients = async () => [];
  await AlertaService.notificarNovoAlerta(1);

  assert.equal(pushChamado, false);
});

test("findByMaquinaId valida maquina, aplica limit seguro e filtro de ativos", async () => {
  MaquinaModel.findById = async (id) => ({ id, nome: "Motor" });

  let consulta;
  AlertaModel.findByMaquinaId = async (maquinaId, options) => {
    consulta = { maquinaId, options };
    return [{
      id: 1,
      status: "ATIVO",
      criadoEm: new Date("2026-06-09T10:00:00.000Z"),
      maquina: { criticidade: "ALTA" },
      eventos: [],
      manutencoes: []
    }];
  };

  const result = await AlertaService.findByMaquinaId("4", {
    limit: "999",
    somenteAtivos: true
  });

  assert.deepEqual(consulta, {
    maquinaId: 4,
    options: {
      skip: 0,
      take: 20,
      status: "ATIVO"
    }
  });
  assert.equal(result.total, 1);
  assert.equal(result.dados[0].sla.criticidade, "ALTA");
  assert.equal(result.dados[0].sla.atendimento.limiteMinutos, 30);
  assert.equal(Object.hasOwn(result.dados[0], "eventos"), false);
  assert.equal(Object.hasOwn(result.dados[0], "manutencoes"), false);
});

test("findAll retorna alertas com SLA sem expor fontes internas do calculo", async () => {
  AlertaModel.findAll = async () => [{
    id: 1,
    status: "ATIVO",
    criadoEm: new Date("2026-06-09T10:00:00.000Z"),
    maquina: { criticidade: "MEDIA" },
    eventos: [{ tipo: "ACEITO", criadoEm: new Date("2026-06-09T11:00:00.000Z") }],
    manutencoes: []
  }];

  const result = await AlertaService.findAll();

  assert.equal(result[0].sla.criticidade, "MEDIA");
  assert.equal(result[0].sla.atendimento.status, "CONCLUIDO_NO_PRAZO");
  assert.equal(Object.hasOwn(result[0], "eventos"), false);
  assert.equal(Object.hasOwn(result[0], "manutencoes"), false);
});

test("getSlaSummary agrega alertas abertos por status de SLA", async () => {
  AlertaModel.findOpenForSla = async () => [
    {
      id: 1,
      status: "ATIVO",
      criadoEm: new Date("2026-06-09T10:00:00.000Z"),
      maquina: { criticidade: "ALTA" },
      eventos: [],
      manutencoes: []
    },
    {
      id: 2,
      status: "EM_ANDAMENTO",
      criadoEm: new Date("2026-06-09T10:00:00.000Z"),
      maquina: { criticidade: "MEDIA" },
      eventos: [{ tipo: "ACEITO", criadoEm: new Date("2026-06-09T10:20:00.000Z") }],
      manutencoes: []
    }
  ];

  const originalDate = global.Date;
  const fixedNow = new originalDate("2026-06-09T20:00:00.000Z");

  global.Date = class extends originalDate {
    constructor(...args) {
      return args.length ? new originalDate(...args) : fixedNow;
    }

    static now() {
      return fixedNow.getTime();
    }
  };

  try {
    assert.deepEqual(await AlertaService.getSlaSummary(), {
      slaAtendimentoEmRisco: 0,
      slaAtendimentoAtrasado: 1,
      slaResolucaoEmRisco: 1,
      slaResolucaoAtrasado: 1
    });
  } finally {
    global.Date = originalDate;
  }
});

test("findByMaquinaId falha para id invalido ou maquina inexistente", async () => {
  await assert.rejects(
    () => AlertaService.findByMaquinaId("abc"),
    (error) => error.name === "AppError" && error.statusCode === 400
  );

  MaquinaModel.findById = async () => null;

  await assert.rejects(
    () => AlertaService.findByMaquinaId("4"),
    (error) => error.name === "AppError" && error.statusCode === 404
  );
});

test("findEventosByAlertaId retorna eventos e preserva erro 404", async () => {
  AlertaModel.findById = async () => ({ id: 5 });
  AlertaModel.findEventosByAlertaId = async (id) => [{ id: 1, alertaId: Number(id) }];

  assert.deepEqual(await AlertaService.findEventosByAlertaId("5"), [{ id: 1, alertaId: 5 }]);

  AlertaModel.findById = async () => null;

  await assert.rejects(
    () => AlertaService.findEventosByAlertaId("5"),
    (error) => error.name === "AppError" && error.statusCode === 404
  );
});

test("countActiveAlertas encapsula falhas do model como AppError", async () => {
  AlertaModel.countActiveAlertas = async () => {
    throw new Error("db fora");
  };

  await assert.rejects(
    () => AlertaService.countActiveAlertas(),
    (error) => error.name === "AppError" && error.statusCode === 500
  );
});
