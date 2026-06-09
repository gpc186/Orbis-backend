const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  SLA_STATUS,
  calculateSla,
  summarizeOpenSla
} = require("../../../src/services/alertaSlaService");

function alerta(overrides = {}) {
  return {
    id: 1,
    status: "ATIVO",
    criadoEm: new Date("2026-06-09T10:00:00.000Z"),
    encerradoEm: null,
    maquina: { criticidade: "ALTA" },
    eventos: [],
    manutencoes: [],
    ...overrides
  };
}

test("calculateSla aplica prazos por criticidade", () => {
  const alta = calculateSla(alerta({ maquina: { criticidade: "ALTA" } }));
  const media = calculateSla(alerta({ maquina: { criticidade: "MEDIA" } }));
  const baixa = calculateSla(alerta({ maquina: { criticidade: "BAIXA" } }));

  assert.equal(alta.atendimento.limiteMinutos, 30);
  assert.equal(alta.resolucao.limiteMinutos, 240);
  assert.equal(media.atendimento.limiteMinutos, 120);
  assert.equal(media.resolucao.limiteMinutos, 720);
  assert.equal(baixa.atendimento.limiteMinutos, 480);
  assert.equal(baixa.resolucao.limiteMinutos, 2880);
});

test("calculateSla marca no prazo, em risco e atrasado para alertas abertos", () => {
  const base = alerta({ maquina: { criticidade: "ALTA" } });

  assert.equal(
    calculateSla(base, { referenceDate: new Date("2026-06-09T10:20:00.000Z") }).atendimento.status,
    SLA_STATUS.NO_PRAZO
  );
  assert.equal(
    calculateSla(base, { referenceDate: new Date("2026-06-09T10:24:00.000Z") }).atendimento.status,
    SLA_STATUS.EM_RISCO
  );
  assert.equal(
    calculateSla(base, { referenceDate: new Date("2026-06-09T10:31:00.000Z") }).atendimento.status,
    SLA_STATUS.ATRASADO
  );
});

test("calculateSla conclui atendimento por evento ACEITO ou fallback de manutencao", () => {
  const comEvento = calculateSla(alerta({
    eventos: [{ tipo: "ACEITO", criadoEm: new Date("2026-06-09T10:20:00.000Z") }]
  }));
  const comFallback = calculateSla(alerta({
    eventos: [],
    manutencoes: [{ criadoEm: new Date("2026-06-09T10:40:00.000Z") }]
  }));

  assert.equal(comEvento.atendimento.status, SLA_STATUS.CONCLUIDO_NO_PRAZO);
  assert.deepEqual(comEvento.atendimento.concluidoEm, new Date("2026-06-09T10:20:00.000Z"));
  assert.equal(comFallback.atendimento.status, SLA_STATUS.CONCLUIDO_ATRASADO);
  assert.deepEqual(comFallback.atendimento.concluidoEm, new Date("2026-06-09T10:40:00.000Z"));
});

test("calculateSla conclui resolucao por encerradoEm ou evento RESOLVIDO", () => {
  const porEncerramento = calculateSla(alerta({
    encerradoEm: new Date("2026-06-09T13:00:00.000Z")
  }));
  const porEvento = calculateSla(alerta({
    encerradoEm: null,
    eventos: [{ tipo: "RESOLVIDO", criadoEm: new Date("2026-06-09T15:00:00.000Z") }]
  }));

  assert.equal(porEncerramento.resolucao.status, SLA_STATUS.CONCLUIDO_NO_PRAZO);
  assert.deepEqual(porEncerramento.resolucao.concluidoEm, new Date("2026-06-09T13:00:00.000Z"));
  assert.equal(porEvento.resolucao.status, SLA_STATUS.CONCLUIDO_ATRASADO);
  assert.deepEqual(porEvento.resolucao.concluidoEm, new Date("2026-06-09T15:00:00.000Z"));
});

test("calculateSla marca alerta cancelado como nao aplicavel", () => {
  const sla = calculateSla(alerta({ status: "CANCELADO" }));

  assert.equal(sla.atendimento.status, SLA_STATUS.NAO_APLICAVEL);
  assert.equal(sla.resolucao.status, SLA_STATUS.NAO_APLICAVEL);
});

test("summarizeOpenSla conta apenas SLAs abertos em risco ou atrasados", () => {
  const resumo = summarizeOpenSla([
    alerta({
      id: 1,
      status: "ATIVO",
      criadoEm: new Date("2026-06-09T10:00:00.000Z"),
      maquina: { criticidade: "ALTA" }
    }),
    alerta({
      id: 2,
      status: "EM_ANDAMENTO",
      criadoEm: new Date("2026-06-09T10:00:00.000Z"),
      maquina: { criticidade: "MEDIA" },
      eventos: [{ tipo: "ACEITO", criadoEm: new Date("2026-06-09T10:10:00.000Z") }]
    }),
    alerta({
      id: 3,
      status: "RESOLVIDO",
      criadoEm: new Date("2026-06-09T10:00:00.000Z"),
      maquina: { criticidade: "ALTA" }
    })
  ], { referenceDate: new Date("2026-06-09T20:00:00.000Z") });

  assert.deepEqual(resumo, {
    slaAtendimentoEmRisco: 0,
    slaAtendimentoAtrasado: 1,
    slaResolucaoEmRisco: 1,
    slaResolucaoAtrasado: 1
  });
});
