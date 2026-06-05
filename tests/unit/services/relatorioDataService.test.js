const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");

const RelatorioDataService = require("../../../src/services/relatorioDataService");
const RelatorioReadModel = require("../../../src/models/relatorioReadModel");

const originals = {
  countMaquinasAtivas: RelatorioReadModel.countMaquinasAtivas,
  countMaquinasAltaImportancia: RelatorioReadModel.countMaquinasAltaImportancia,
  calculateIntegridadeMedia: RelatorioReadModel.calculateIntegridadeMedia,
  countChamadosAbertos: RelatorioReadModel.countChamadosAbertos,
  findStatusDasMaquinas: RelatorioReadModel.findStatusDasMaquinas,
  countMaquinasPorCriticidade: RelatorioReadModel.countMaquinasPorCriticidade,
  findIntegridadePorSetor: RelatorioReadModel.findIntegridadePorSetor,
  countSensoresPorStatus: RelatorioReadModel.countSensoresPorStatus,
  findChamados: RelatorioReadModel.findChamados,
  findHistoricoTendencia: RelatorioReadModel.findHistoricoTendencia
};

afterEach(() => {
  RelatorioReadModel.countMaquinasAtivas = originals.countMaquinasAtivas;
  RelatorioReadModel.countMaquinasAltaImportancia = originals.countMaquinasAltaImportancia;
  RelatorioReadModel.calculateIntegridadeMedia = originals.calculateIntegridadeMedia;
  RelatorioReadModel.countChamadosAbertos = originals.countChamadosAbertos;
  RelatorioReadModel.findStatusDasMaquinas = originals.findStatusDasMaquinas;
  RelatorioReadModel.countMaquinasPorCriticidade = originals.countMaquinasPorCriticidade;
  RelatorioReadModel.findIntegridadePorSetor = originals.findIntegridadePorSetor;
  RelatorioReadModel.countSensoresPorStatus = originals.countSensoresPorStatus;
  RelatorioReadModel.findChamados = originals.findChamados;
  RelatorioReadModel.findHistoricoTendencia = originals.findHistoricoTendencia;
});

function mockReadModel(calls) {
  RelatorioReadModel.countMaquinasAtivas = async (payload) => {
    calls.push(["countMaquinasAtivas", payload]);
    return 12;
  };
  RelatorioReadModel.countMaquinasAltaImportancia = async (payload) => {
    calls.push(["countMaquinasAltaImportancia", payload]);
    return 3;
  };
  RelatorioReadModel.calculateIntegridadeMedia = async (payload) => {
    calls.push(["calculateIntegridadeMedia", payload]);
    return { _avg: { integridade: 87.64 } };
  };
  RelatorioReadModel.countChamadosAbertos = async (payload) => {
    calls.push(["countChamadosAbertos", payload]);
    return 2;
  };
  RelatorioReadModel.findStatusDasMaquinas = async (payload) => {
    calls.push(["findStatusDasMaquinas", payload]);
    return { operando: 8, emAlerta: 2, inativa: 1 };
  };
  RelatorioReadModel.countMaquinasPorCriticidade = async (payload) => {
    calls.push(["countMaquinasPorCriticidade", payload]);
    return { alta: 3, media: 5, baixa: 4 };
  };
  RelatorioReadModel.findIntegridadePorSetor = async (payload) => {
    calls.push(["findIntegridadePorSetor", payload]);
    return [{ setor: "Linha A", integridadeMedia: 91.2 }];
  };
  RelatorioReadModel.countSensoresPorStatus = async (payload) => {
    calls.push(["countSensoresPorStatus", payload]);
    return { online: 10, offline: 1, inativo: 2 };
  };
  RelatorioReadModel.findChamados = async (payload) => {
    calls.push(["findChamados", payload]);
    return [{ id: 1, status: "ATIVO" }];
  };
  RelatorioReadModel.findHistoricoTendencia = async (payload) => {
    calls.push(["findHistoricoTendencia", payload]);
    return [{ data: "2026-06-04", quantidade: 2 }];
  };
}

test("resolveDateRange monta intervalo customizado com label publico", () => {
  const range = RelatorioDataService.resolveDateRange({
    inicio: "2026-06-01T14:30:00.000Z",
    fim: "2026-06-04T09:00:00.000Z"
  });

  assert.equal(range.start.toISOString(), "2026-06-01T03:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-06-05T02:59:59.999Z");
  assert.equal(range.label, "01/06/2026 ate 04/06/2026");
});

test("collect consulta apenas secoes pedidas e monta payload publico", async () => {
  const calls = [];
  mockReadModel(calls);

  const filtros = {
    secoes: ["resumo", "sensores", "chamados"],
    maquinasIds: [1, 2]
  };
  const result = await RelatorioDataService.collect({
    periodo: { inicio: "2026-06-01T12:00:00.000Z", fim: "2026-06-04T12:00:00.000Z" },
    filtros
  });

  assert.deepEqual(calls.map(([name]) => name), [
    "countMaquinasAtivas",
    "countMaquinasAltaImportancia",
    "calculateIntegridadeMedia",
    "countChamadosAbertos",
    "countSensoresPorStatus",
    "findChamados"
  ]);
  assert.deepEqual(result, {
    periodoLabel: "01/06/2026 ate 04/06/2026",
    resumo: {
      maquinasAtivas: 12,
      maquinasAltaImportancia: 3,
      integridadeMedia: 87.6,
      chamadosAbertos: 2
    },
    desempenho: null,
    sensores: { online: 10, offline: 1, inativo: 2 },
    chamados: [{ id: 1, status: "ATIVO" }],
    historicoTendencia: null
  });

  const chamadoPayload = calls.find(([name]) => name === "findChamados")[1];
  assert.deepEqual(chamadoPayload.filtros, filtros);
  assert.equal(chamadoPayload.range.start.toISOString(), "2026-06-01T03:00:00.000Z");
});

test("collect preenche secoes de desempenho e historico quando solicitadas", async () => {
  const calls = [];
  mockReadModel(calls);

  const result = await RelatorioDataService.collect({
    periodo: { inicio: "2026-06-01T12:00:00.000Z", fim: "2026-06-04T12:00:00.000Z" },
    filtros: { secoes: ["desempenho", "historicoTendencia"] }
  });

  assert.deepEqual(calls.map(([name]) => name), [
    "findStatusDasMaquinas",
    "countMaquinasPorCriticidade",
    "findIntegridadePorSetor",
    "findHistoricoTendencia"
  ]);
  assert.deepEqual(result.desempenho, {
    statusDasMaquinas: { operando: 8, emAlerta: 2, inativa: 1 },
    maquinasPorImportancia: { alta: 3, media: 5, baixa: 4 },
    integridadePorSetor: [{ setor: "Linha A", integridadeMedia: 91.2 }]
  });
  assert.deepEqual(result.historicoTendencia, [{ data: "2026-06-04", quantidade: 2 }]);
  assert.equal(result.resumo, null);
  assert.equal(result.sensores, null);
  assert.equal(result.chamados, null);
});
