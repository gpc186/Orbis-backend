const assert = require("node:assert/strict");
const test = require("node:test");

const MaquinaModel = require("../models/maquinaModel");
const HistoricoIntegridadeModel = require("../models/historicoIntegridadeModel");
const PredicaoService = require("./predicaoService");

const RealDate = Date;

function useFakeNow(isoString) {
  const fixedNow = new RealDate(isoString);

  global.Date = class FakeDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) {
        return new RealDate(fixedNow);
      }

      return new RealDate(...args);
    }

    static now() {
      return fixedNow.getTime();
    }

    static parse(value) {
      return RealDate.parse(value);
    }

    static UTC(...args) {
      return RealDate.UTC(...args);
    }
  };

  return () => {
    global.Date = RealDate;
  };
}

function buildHistorico(valores, startIso = "2026-05-21T00:00:00.000Z", stepHours = 1) {
  const inicio = new RealDate(startIso).getTime();

  return valores.map((integridade, index) => ({
    id: index + 1,
    maquinaId: 1,
    integridade,
    criadoEm: new RealDate(inicio + (index * stepHours * 60 * 60 * 1000)).toISOString()
  }));
}

function mockPredicaoDependencies(historico) {
  const originalFindById = MaquinaModel.findById;
  const originalUpdate = MaquinaModel.update;
  const originalFindSerieByMaquina = HistoricoIntegridadeModel.findSerieByMaquina;

  const updateCalls = [];

  MaquinaModel.findById = async () => ({ id: 1, nome: "Maquina teste" });
  MaquinaModel.update = async (id, data) => {
    updateCalls.push({ id, data });
    return { id, ...data };
  };
  HistoricoIntegridadeModel.findSerieByMaquina = async () => historico;

  return {
    updateCalls,
    restore() {
      MaquinaModel.findById = originalFindById;
      MaquinaModel.update = originalUpdate;
      HistoricoIntegridadeModel.findSerieByMaquina = originalFindSerieByMaquina;
    }
  };
}

test("previsaoManutencao limpa a previsao quando nao ha pontos suficientes", async () => {
  const restoreDate = useFakeNow("2026-05-21T07:00:00.000Z");
  const mocks = mockPredicaoDependencies(buildHistorico([100, 99, 98, 97, 96, 95, 94]));

  try {
    const resultado = await PredicaoService.previsaoManutencao(1);

    assert.equal(mocks.updateCalls.length, 1);
    assert.deepEqual(mocks.updateCalls[0].data, {
      previsaoManutencao: null,
      janelaManuInicio: null,
      janelaManuFim: null
    });
    assert.deepEqual(resultado, {
      id: 1,
      previsaoManutencao: null,
      janelaManuInicio: null,
      janelaManuFim: null
    });
  } finally {
    mocks.restore();
    restoreDate();
  }
});

test("previsaoManutencao limpa a previsao quando o ajuste tem r2 baixo", async () => {
  const restoreDate = useFakeNow("2026-05-21T07:00:00.000Z");
  const mocks = mockPredicaoDependencies(buildHistorico([100, 40, 95, 35, 90, 30, 85, 25]));

  try {
    await PredicaoService.previsaoManutencao(1);

    assert.equal(mocks.updateCalls.length, 1);
    assert.deepEqual(mocks.updateCalls[0].data, {
      previsaoManutencao: null,
      janelaManuInicio: null,
      janelaManuFim: null
    });
  } finally {
    mocks.restore();
    restoreDate();
  }
});

test("previsaoManutencao limpa a previsao quando a falha projetada ja ficou no passado", async () => {
  const restoreDate = useFakeNow("2026-05-21T08:00:00.000Z");
  const mocks = mockPredicaoDependencies(buildHistorico([100, 90, 80, 70, 60, 50, 40, 20]));

  try {
    await PredicaoService.previsaoManutencao(1);

    assert.equal(mocks.updateCalls.length, 1);
    assert.deepEqual(mocks.updateCalls[0].data, {
      previsaoManutencao: null,
      janelaManuInicio: null,
      janelaManuFim: null
    });
  } finally {
    mocks.restore();
    restoreDate();
  }
});

test("previsaoManutencao gera janela futura e mantem fim com antecedencia de dois dias", async () => {
  const restoreDate = useFakeNow("2026-05-21T07:00:00.000Z");
  const mocks = mockPredicaoDependencies(buildHistorico([100, 99, 98, 97, 96, 95, 94, 93]));

  try {
    const resultado = await PredicaoService.previsaoManutencao(1);

    assert.equal(mocks.updateCalls.length, 1);

    const payload = mocks.updateCalls[0].data;
    assert.equal(payload.previsaoManutencao.toISOString(), "2026-05-23T22:00:00.000Z");
    assert.equal(payload.janelaManuInicio.toISOString(), "2026-05-22T06:00:00.000Z");
    assert.equal(payload.janelaManuFim.toISOString(), "2026-05-22T06:00:00.000Z");
    assert.deepEqual(resultado, { id: 1, ...payload });
  } finally {
    mocks.restore();
    restoreDate();
  }
});

test("previsaoManutencao inicia a janela imediatamente quando o limiar de manutencao ja foi cruzado", async () => {
  const restoreDate = useFakeNow("2026-05-21T07:00:00.000Z");
  const mocks = mockPredicaoDependencies(buildHistorico([68, 67, 66, 65, 64, 63, 62, 61]));

  try {
    await PredicaoService.previsaoManutencao(1);

    const payload = mocks.updateCalls[0].data;
    assert.equal(payload.previsaoManutencao.toISOString(), "2026-05-22T14:00:00.000Z");
    assert.equal(payload.janelaManuInicio.toISOString(), "2026-05-21T07:00:00.000Z");
    assert.equal(payload.janelaManuFim.toISOString(), "2026-05-21T07:00:00.000Z");
  } finally {
    mocks.restore();
    restoreDate();
  }
});
