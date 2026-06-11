const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");

const AlertaController = require("../../../src/controllers/alertaController");
const ManutencaoController = require("../../../src/controllers/manutencaoController");
const LeituraController = require("../../../src/controllers/leituraController");
const HistoricoIntegridadeController = require("../../../src/controllers/historicoIntegridadeController");
const AlertaService = require("../../../src/services/alertaService");
const ManutencaoService = require("../../../src/services/manutencaoService");
const LeituraService = require("../../../src/services/leituraService");
const HistoricoIntegridadeService = require("../../../src/services/historicoIntegridadeService");

const originals = {
  countMaquinasWithAlerta: AlertaService.countMaquinasWithAlerta,
  countActiveAlertas: AlertaService.countActiveAlertas,
  countAlertasToday: AlertaService.countAlertasToday,
  countAlertaSemAtendimento: AlertaService.countAlertaSemAtendimento,
  countAtendedToday: AlertaService.countAtendedToday,
  findAllAlertas: AlertaService.findAll,
  findAllEventos: AlertaService.findAllEventos,
  findEventosByAlertaId: AlertaService.findEventosByAlertaId,
  findAlertaById: AlertaService.findById,
  createAlertaComentario: AlertaService.createComentario,
  createManutencao: ManutencaoService.create,
  findManutencaoById: ManutencaoService.findById,
  findManutencaoByAlertaId: ManutencaoService.findByAlertaId,
  updateManutencao: ManutencaoService.update,
  listManutencao: ManutencaoService.list,
  processarNovaLeitura: LeituraService.processarNovaLeitura,
  indexLeitura: LeituraService.index,
  createHistorico: HistoricoIntegridadeService.create,
  listHistorico: HistoricoIntegridadeService.list,
  listHistoricoByMaquina: HistoricoIntegridadeService.listByMaquina,
  findHistoricoById: HistoricoIntegridadeService.findById
};

function createResponse() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

function captureNext() {
  const calls = [];
  const next = (error) => calls.push(error);
  next.calls = calls;
  return next;
}

afterEach(() => {
  AlertaService.countMaquinasWithAlerta = originals.countMaquinasWithAlerta;
  AlertaService.countActiveAlertas = originals.countActiveAlertas;
  AlertaService.countAlertasToday = originals.countAlertasToday;
  AlertaService.countAlertaSemAtendimento = originals.countAlertaSemAtendimento;
  AlertaService.countAtendedToday = originals.countAtendedToday;
  AlertaService.findAll = originals.findAllAlertas;
  AlertaService.findAllEventos = originals.findAllEventos;
  AlertaService.findEventosByAlertaId = originals.findEventosByAlertaId;
  AlertaService.findById = originals.findAlertaById;
  AlertaService.createComentario = originals.createAlertaComentario;
  ManutencaoService.create = originals.createManutencao;
  ManutencaoService.findById = originals.findManutencaoById;
  ManutencaoService.findByAlertaId = originals.findManutencaoByAlertaId;
  ManutencaoService.update = originals.updateManutencao;
  ManutencaoService.list = originals.listManutencao;
  LeituraService.processarNovaLeitura = originals.processarNovaLeitura;
  LeituraService.index = originals.indexLeitura;
  HistoricoIntegridadeService.create = originals.createHistorico;
  HistoricoIntegridadeService.list = originals.listHistorico;
  HistoricoIntegridadeService.listByMaquina = originals.listHistoricoByMaquina;
  HistoricoIntegridadeService.findById = originals.findHistoricoById;
});

test("AlertaController.summary agrega contadores em resposta publica", async () => {
  AlertaService.countMaquinasWithAlerta = async () => 2;
  AlertaService.countActiveAlertas = async () => 5;
  AlertaService.countAlertasToday = async () => 3;
  AlertaService.countAlertaSemAtendimento = async () => 1;
  AlertaService.countAtendedToday = async () => 4;

  const res = createResponse();
  await AlertaController.summary({}, res, captureNext());

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    maquinasEmAlerta: 2,
    alertasAtivos: 5,
    alertasHoje: 3,
    alertaSemAtendimento: 1,
    alertasAtendidosHoje: 4
  });
});

test("AlertaController lista alertas, eventos e detalhes por id", async () => {
  const chamadas = [];
  AlertaService.findAll = async () => {
    chamadas.push(["list"]);
    return [{ id: 1 }];
  };
  AlertaService.findAllEventos = async () => {
    chamadas.push(["eventos"]);
    return [{ id: 2 }];
  };
  AlertaService.findEventosByAlertaId = async (id) => {
    chamadas.push(["eventosPorAlerta", id]);
    return [{ id: 3, alertaId: Number(id) }];
  };
  AlertaService.findById = async (id) => {
    chamadas.push(["findById", id]);
    return { id: Number(id) };
  };

  const listRes = createResponse();
  await AlertaController.list({}, listRes, captureNext());

  const eventosRes = createResponse();
  await AlertaController.listEventos({}, eventosRes, captureNext());

  const eventosByIdRes = createResponse();
  await AlertaController.listEventosByAlertaId({ params: { id: "7" } }, eventosByIdRes, captureNext());

  const findRes = createResponse();
  await AlertaController.findById({ params: { id: "7" } }, findRes, captureNext());

  assert.deepEqual(chamadas, [
    ["list"],
    ["eventos"],
    ["eventosPorAlerta", "7"],
    ["findById", "7"]
  ]);
  assert.deepEqual(listRes.body, [{ id: 1 }]);
  assert.deepEqual(eventosRes.body, [{ id: 2 }]);
  assert.deepEqual(eventosByIdRes.body, [{ id: 3, alertaId: 7 }]);
  assert.deepEqual(findRes.body, { id: 7 });
});

test("AlertaController.createComentario repassa params, usuario e body ao service", async () => {
  let payloadRecebido;
  AlertaService.createComentario = async (payload) => {
    payloadRecebido = payload;
    return {
      id: 31,
      alertaId: Number(payload.alertaId),
      mensagem: payload.mensagem
    };
  };

  const res = createResponse();
  await AlertaController.createComentario({
    params: { id: "7" },
    usuario: { id: 2, role: "TECNICO" },
    body: { mensagem: "Verifiquei a maquina." }
  }, res, captureNext());

  assert.deepEqual(payloadRecebido, {
    alertaId: "7",
    usuario: { id: 2, role: "TECNICO" },
    mensagem: "Verifiquei a maquina."
  });
  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body, {
    id: 31,
    alertaId: 7,
    mensagem: "Verifiquei a maquina."
  });
});

test("ManutencaoController repassa payloads e usuario autenticado", async () => {
  const chamadas = [];
  ManutencaoService.create = async (payload) => {
    chamadas.push(["create", payload]);
    return { id: 1 };
  };
  ManutencaoService.findById = async (id) => {
    chamadas.push(["findById", id]);
    return { id: Number(id) };
  };
  ManutencaoService.findByAlertaId = async (id) => {
    chamadas.push(["findByAlertaId", id]);
    return [{ alertaId: Number(id) }];
  };
  ManutencaoService.update = async (id, usuarioId, payload) => {
    chamadas.push(["update", id, usuarioId, payload]);
    return { id: Number(id), ...payload.dados };
  };
  ManutencaoService.list = async (payload) => {
    chamadas.push(["list", payload]);
    return { dados: [] };
  };

  const createRes = createResponse();
  await ManutencaoController.create({
    usuario: { id: 9 },
    body: { alertaId: "4", tipo: "CORRETIVA", maquinaId: "8", observacao: "verificar" }
  }, createRes, captureNext());

  const findRes = createResponse();
  await ManutencaoController.findById({ params: { id: "5" } }, findRes, captureNext());

  const byAlertaRes = createResponse();
  await ManutencaoController.findByAlertaId({ params: { id: "4" } }, byAlertaRes, captureNext());

  const updateRes = createResponse();
  await ManutencaoController.update({
    usuario: { id: 9 },
    params: { id: "5" },
    body: { status: "RESOLVIDO", observacao: "ok" }
  }, updateRes, captureNext());

  const listRes = createResponse();
  await ManutencaoController.list({
    usuario: { id: 9, role: "TECNICO" },
    query: { page: "2", limit: "10" }
  }, listRes, captureNext());

  assert.deepEqual(chamadas, [
    ["create", {
      alertaId: "4",
      maquinaId: "8",
      tipo: "CORRETIVA",
      titulo: undefined,
      prioridade: undefined,
      dataAgendada: undefined,
      usuarioId: 9,
      observacao: "verificar"
    }],
    ["findById", "5"],
    ["findByAlertaId", "4"],
    ["update", "5", 9, { dados: { status: "RESOLVIDO", observacao: "ok" } }],
    ["list", { page: "2", limit: "10", usuario: { id: 9, role: "TECNICO" } }]
  ]);
  assert.equal(createRes.statusCode, 201);
  assert.deepEqual(findRes.body, { id: 5 });
  assert.deepEqual(byAlertaRes.body, [{ alertaId: 4 }]);
  assert.deepEqual(updateRes.body, { id: 5, status: "RESOLVIDO", observacao: "ok" });
  assert.deepEqual(listRes.body, { dados: [] });
});

test("LeituraController.store valida payload, salva leitura e emite socket", async () => {
  const incompleteRes = createResponse();
  await LeituraController.store({
    body: { sensorId: 1, temperatura: 30 },
    app: { get: () => null }
  }, incompleteRes, captureNext());

  assert.equal(incompleteRes.statusCode, 400);
  assert.deepEqual(incompleteRes.body, { error: "Dados incompletos" });

  let payloadRecebido;
  LeituraService.processarNovaLeitura = async (payload) => {
    payloadRecebido = payload;
    return { id: 10, ...payload };
  };

  const emits = [];
  const req = {
    requestId: "req-1",
    body: { sensorId: 1, temperatura: 31, vibracao: 4 },
    app: {
      get(name) {
        assert.equal(name, "io");
        return {
          emit(event, payload) {
            emits.push([event, payload]);
          }
        };
      }
    }
  };
  const res = createResponse();

  await LeituraController.store(req, res, captureNext());

  assert.deepEqual(payloadRecebido, { sensorId: 1, temperatura: 31, vibracao: 4 });
  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body, { id: 10, sensorId: 1, temperatura: 31, vibracao: 4 });
  assert.deepEqual(emits, [
    ["nova-leitura", res.body],
    ["novaLeitura", res.body]
  ]);
});

test("LeituraController.index retorna leituras em ordem cronologica reversa do service", async () => {
  LeituraService.index = async () => [{ id: 3 }, { id: 2 }, { id: 1 }];

  const res = createResponse();
  await LeituraController.index({}, res, captureNext());

  assert.equal(res.statusCode, null);
  assert.deepEqual(res.body, [{ id: 1 }, { id: 2 }, { id: 3 }]);
});

test("HistoricoIntegridadeController repassa body, query e params ao service", async () => {
  const chamadas = [];
  HistoricoIntegridadeService.create = async (payload) => {
    chamadas.push(["create", payload]);
    return { id: 1, ...payload };
  };
  HistoricoIntegridadeService.list = async (query) => {
    chamadas.push(["list", query]);
    return [{ id: 2 }];
  };
  HistoricoIntegridadeService.listByMaquina = async (id, query) => {
    chamadas.push(["listByMaquina", id, query]);
    return [{ maquinaId: Number(id) }];
  };
  HistoricoIntegridadeService.findById = async (id) => {
    chamadas.push(["findById", id]);
    return { id: Number(id) };
  };

  const storeRes = createResponse();
  await HistoricoIntegridadeController.store({ body: { maquinaId: 1, integridade: 90 } }, storeRes, captureNext());

  const indexRes = createResponse();
  await HistoricoIntegridadeController.index({ query: { limite: "10" } }, indexRes, captureNext());

  const byMaquinaRes = createResponse();
  await HistoricoIntegridadeController.listByMaquina({
    params: { id: "4" },
    query: { limite: "5" }
  }, byMaquinaRes, captureNext());

  const showRes = createResponse();
  await HistoricoIntegridadeController.show({ params: { id: "8" } }, showRes, captureNext());

  assert.deepEqual(chamadas, [
    ["create", { maquinaId: 1, integridade: 90 }],
    ["list", { limite: "10" }],
    ["listByMaquina", "4", { limite: "5" }],
    ["findById", "8"]
  ]);
  assert.equal(storeRes.statusCode, 201);
  assert.deepEqual(indexRes.body, [{ id: 2 }]);
  assert.deepEqual(byMaquinaRes.body, [{ maquinaId: 4 }]);
  assert.deepEqual(showRes.body, { id: 8 });
});

test("controllers operacionais encaminham erros para next", async () => {
  const errors = {
    alerta: new Error("alerta falhou"),
    manutencao: new Error("manutencao falhou"),
    leitura: new Error("leitura falhou"),
    historico: new Error("historico falhou")
  };

  AlertaService.findById = async () => {
    throw errors.alerta;
  };
  ManutencaoService.findById = async () => {
    throw errors.manutencao;
  };
  LeituraService.index = async () => {
    throw errors.leitura;
  };
  HistoricoIntegridadeService.findById = async () => {
    throw errors.historico;
  };

  const alertaNext = captureNext();
  await AlertaController.findById({ params: { id: "1" } }, createResponse(), alertaNext);

  const manutencaoNext = captureNext();
  await ManutencaoController.findById({ params: { id: "1" } }, createResponse(), manutencaoNext);

  const leituraNext = captureNext();
  await LeituraController.index({}, createResponse(), leituraNext);

  const historicoNext = captureNext();
  await HistoricoIntegridadeController.show({ params: { id: "1" } }, createResponse(), historicoNext);

  assert.deepEqual(alertaNext.calls, [errors.alerta]);
  assert.deepEqual(manutencaoNext.calls, [errors.manutencao]);
  assert.deepEqual(leituraNext.calls, [errors.leitura]);
  assert.deepEqual(historicoNext.calls, [errors.historico]);
});
