const { after, before, test } = require("node:test");
const assert = require("node:assert/strict");

require("../../src/config/env")();

const databaseUrl = process.env.DATABASE_URL || "";
const isSafeTestDatabase =
  process.env.NODE_ENV === "TEST" &&
  (/orbis_test|test/i.test(databaseUrl) || /localhost|127\.0\.0\.1/.test(databaseUrl));

let prisma;
let UsuarioModel;
let MaquinaModel;
let SensorModel;
let AlertaModel;
let RelatorioAgendamentoModel;

if (isSafeTestDatabase) {
  prisma = require("../../src/prisma/prisma");
  UsuarioModel = require("../../src/models/usuarioModel");
  MaquinaModel = require("../../src/models/maquinaModel");
  SensorModel = require("../../src/models/sensorModel");
  AlertaModel = require("../../src/models/alertaModel");
  RelatorioAgendamentoModel = require("../../src/models/relatorioAgendamentoModel");
}

async function cleanDatabase() {
  if (!isSafeTestDatabase) return;

  await prisma.$transaction([
    prisma.aiActionConfirmation.deleteMany(),
    prisma.relatorioExecucao.deleteMany(),
    prisma.relatorioDestinatario.deleteMany(),
    prisma.relatorioAgendamento.deleteMany(),
    prisma.alertaEvento.deleteMany(),
    prisma.manutencao.deleteMany(),
    prisma.alerta.deleteMany(),
    prisma.leitura.deleteMany(),
    prisma.sensor.deleteMany(),
    prisma.historicoIntegridade.deleteMany(),
    prisma.maquinaManual.deleteMany(),
    prisma.maquina.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.passwordResetCode.deleteMany(),
    prisma.usuario.deleteMany()
  ]);
}

before(async () => {
  await cleanDatabase();
});

after(async () => {
  await cleanDatabase();
  await prisma?.$disconnect();
});

test("models Prisma persistem fluxo principal em banco real", {
  skip: isSafeTestDatabase ? false : "Defina NODE_ENV=TEST e DATABASE_URL de teste para rodar integracao."
}, async () => {
  const unique = Date.now();
  const usuario = await UsuarioModel.create({
    nome: "Admin Integracao",
    email: `admin-integracao-${unique}@orbis.local`,
    senha: "hash",
    role: "ADMIN"
  });

  const maquina = await MaquinaModel.create({
    nome: `Prensa Integracao ${unique}`,
    setor: "Teste",
    tipo: "Prensa",
    criticidade: "ALTA"
  });

  const historicoInicial = await prisma.historicoIntegridade.findMany({
    where: { maquinaId: maquina.id }
  });

  assert.equal(historicoInicial.length, 1);
  assert.equal(historicoInicial[0].origem, "CADASTRO_MAQUINA");

  const sensor = await SensorModel.create({
    tipo: "temperatura",
    maquinaId: maquina.id,
    limiteTemperatura: "90",
    idealTemperatura: "70",
    limiteVibracao: "12",
    idealVibracao: "4",
    desvioMaximoTemp: "10",
    desvioMaximoVibra: "2"
  });

  assert.equal(sensor.maquinaId, maquina.id);
  assert.equal(sensor.status, "ONLINE");

  const alerta = await AlertaModel.create(
    sensor.id,
    maquina.id,
    "LIMITE_ULTRAPASSADO",
    "Temperatura acima do limite em teste de integracao."
  );

  const eventos = await AlertaModel.findEventosByAlertaId(alerta.id);

  assert.equal(alerta.status, "ATIVO");
  assert.equal(eventos.length, 1);
  assert.equal(eventos[0].tipo, "CRIADO");

  const proximoEnvioEm = new Date(Date.now() - 60_000);
  const agendamento = await RelatorioAgendamentoModel.create({
    data: {
      nome: `Relatorio Integracao ${unique}`,
      criadoPorId: usuario.id,
      frequencia: "DIARIO",
      hora: 8,
      minuto: 0,
      assunto: "Resumo de integracao",
      tipoPeriodo: "RELATIVE_DAYS",
      periodo: { tipo: "RELATIVE_DAYS", valor: 7 },
      filtros: { secoes: ["resumo"] },
      secoes: ["resumo"],
      proximoEnvioEm
    },
    emailsDestino: [`destino-${unique}@orbis.local`]
  });

  assert.equal(agendamento.destinatarios.length, 1);
  assert.equal(agendamento.criadoPor.id, usuario.id);

  const due = await RelatorioAgendamentoModel.listDue(new Date(), 5);
  assert.ok(due.some((item) => item.id === agendamento.id));

  const locked = await RelatorioAgendamentoModel.tryLock(agendamento.id, new Date());
  const lockedAgain = await RelatorioAgendamentoModel.tryLock(agendamento.id, new Date());

  assert.equal(locked, true);
  assert.equal(lockedAgain, false);

  const sentAt = new Date();
  const nextRunAt = new Date(sentAt.getTime() + 24 * 60 * 60 * 1000);
  const success = await RelatorioAgendamentoModel.markScheduledSuccess({
    id: agendamento.id,
    sentAt,
    nextRunAt
  });

  assert.equal(success.lockedAt, null);
  assert.equal(success.ultimoErroEm, null);
  assert.equal(success.ultimoSucessoEm.getTime(), sentAt.getTime());
  assert.equal(success.proximoEnvioEm.getTime(), nextRunAt.getTime());
});
