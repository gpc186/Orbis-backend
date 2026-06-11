const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");

const ManutencaoService = require("../../../src/services/manutencaoService");
const AlertaModel = require("../../../src/models/alertaModel");
const MaquinaModel = require("../../../src/models/maquinaModel");
const ManutencaoModel = require("../../../src/models/manutencaoModel");
const UsuarioModel = require("../../../src/models/usuarioModel");
const simuladorJob = require("../../../src/jobs/simuladorJob");

const originals = {
  alertaFindById: AlertaModel.findById,
  maquinaFindById: MaquinaModel.findById,
  maquinaUpdate: MaquinaModel.update,
  manutencaoCreate: ManutencaoModel.create,
  manutencaoFindAll: ManutencaoModel.findAll,
  manutencaoCount: ManutencaoModel.count,
  manutencaoFindByAlertaId: ManutencaoModel.findByAlertaId,
  manutencaoCreateWithAlertSync: ManutencaoModel.createWithAlertSync,
  manutencaoFindById: ManutencaoModel.findById,
  manutencaoFindOpenPredictiveByMaquinaId: ManutencaoModel.findOpenPredictiveByMaquinaId,
  manutencaoFindOpenManualPreventiveNearDate: ManutencaoModel.findOpenManualPreventiveNearDate,
  manutencaoUpdate: ManutencaoModel.update,
  manutencaoUpdateWithAlertSync: ManutencaoModel.updateWithAlertSync,
  manutencaoUpdatePreventiva: ManutencaoModel.updatePreventiva,
  usuarioFindById: UsuarioModel.findById,
  resetarMaquinaSimulada: simuladorJob.resetarMaquinaSimulada
};

afterEach(() => {
  AlertaModel.findById = originals.alertaFindById;
  MaquinaModel.findById = originals.maquinaFindById;
  MaquinaModel.update = originals.maquinaUpdate;
  ManutencaoModel.create = originals.manutencaoCreate;
  ManutencaoModel.findAll = originals.manutencaoFindAll;
  ManutencaoModel.count = originals.manutencaoCount;
  ManutencaoModel.findByAlertaId = originals.manutencaoFindByAlertaId;
  ManutencaoModel.createWithAlertSync = originals.manutencaoCreateWithAlertSync;
  ManutencaoModel.findById = originals.manutencaoFindById;
  ManutencaoModel.findOpenPredictiveByMaquinaId = originals.manutencaoFindOpenPredictiveByMaquinaId;
  ManutencaoModel.findOpenManualPreventiveNearDate = originals.manutencaoFindOpenManualPreventiveNearDate;
  ManutencaoModel.update = originals.manutencaoUpdate;
  ManutencaoModel.updateWithAlertSync = originals.manutencaoUpdateWithAlertSync;
  ManutencaoModel.updatePreventiva = originals.manutencaoUpdatePreventiva;
  UsuarioModel.findById = originals.usuarioFindById;
  simuladorJob.resetarMaquinaSimulada = originals.resetarMaquinaSimulada;
});

test("create valida entidades e cria manutencao em andamento sincronizada com alerta", async () => {
  AlertaModel.findById = async () => ({ id: 10, status: "ATIVO", maquinaId: 44, maquina: { nome: "Prensa" } });
  ManutencaoModel.findByAlertaId = async () => [{ id: 1, status: "RESOLVIDO" }];
  UsuarioModel.findById = async () => ({ id: 7, role: "TECNICO", ativo: true });

  let payloadRecebido;
  ManutencaoModel.createWithAlertSync = async (payload) => {
    payloadRecebido = payload;
    return { id: 99, ...payload };
  };

  const result = await ManutencaoService.create({
    alertaId: "10",
    usuarioId: "7",
    observacao: "  troca preventiva  "
  });

  assert.deepEqual(payloadRecebido, {
    alertaId: 10,
    usuarioId: 7,
    titulo: "Manutencao corretiva - Prensa",
    prioridade: "MEDIA",
    origem: "ALERTA",
    observacao: "troca preventiva",
    status: "EM_ANDAMENTO",
    concluidaEm: null,
    cumprimentoAgendamento: "NAO_APLICAVEL"
  });
  assert.equal(result.id, 99);
});

test("create cria manutencao preventiva vinculada a maquina sem alerta", async () => {
  UsuarioModel.findById = async () => ({ id: 7, role: "TECNICO", ativo: true });
  MaquinaModel.findById = async () => ({ id: 22, nome: "Esteira", ativo: true });

  let payloadRecebido;
  ManutencaoModel.create = async (payload) => {
    payloadRecebido = payload;
    return { id: 101, ...payload };
  };

  const result = await ManutencaoService.create({
    tipo: "PREVENTIVA",
    maquinaId: "22",
    usuarioId: "7",
    titulo: "Inspecao mensal",
    prioridade: "ALTA",
    observacao: "  inspecao mensal  "
  });

  assert.deepEqual(payloadRecebido, {
    alertaId: null,
    maquinaId: 22,
    usuarioId: 7,
    tipo: "PREVENTIVA",
    titulo: "Inspecao mensal",
    prioridade: "ALTA",
    origem: "MANUAL",
    observacao: "inspecao mensal",
    status: "EM_ANDAMENTO",
    dataAgendada: null,
    janelaAgendadaInicio: null,
    janelaAgendadaFim: null,
    concluidaEm: null,
    cumprimentoAgendamento: "NAO_APLICAVEL",
    metadataPredicao: null
  });
  assert.equal(result.id, 101);
  assert.equal(result.alertaId, null);
});

test("create cria manutencao preventiva agendada quando data futura e enviada", async () => {
  UsuarioModel.findById = async () => ({ id: 7, role: "TECNICO", ativo: true });
  MaquinaModel.findById = async () => ({ id: 22, nome: "Esteira", ativo: true });

  let payloadRecebido;
  ManutencaoModel.create = async (payload) => {
    payloadRecebido = payload;
    return { id: 102, ...payload };
  };

  const dataAgendada = new Date(Date.now() + 86400000).toISOString();
  const result = await ManutencaoService.create({
    tipo: "PREVENTIVA",
    maquinaId: "22",
    usuarioId: "7",
    dataAgendada,
    observacao: "inspecao futura"
  });

  assert.equal(payloadRecebido.status, "AGENDADA");
  assert.equal(payloadRecebido.titulo, "Manutencao preventiva - Esteira");
  assert.equal(payloadRecebido.dataAgendada.toISOString(), dataAgendada);
  assert.equal(result.status, "AGENDADA");
});

test("create preventiva bloqueia admin", async () => {
  UsuarioModel.findById = async () => ({ id: 1, role: "ADMIN", ativo: true });

  await assert.rejects(
    () => ManutencaoService.create({
      tipo: "PREVENTIVA",
      maquinaId: "22",
      usuarioId: "1",
      observacao: "inspecao mensal"
    }),
    (error) => error.name === "AppError" && error.statusCode === 403
  );
});

test("create bloqueia alerta encerrado e manutencao ja em andamento", async () => {
  UsuarioModel.findById = async () => ({ id: 7, role: "TECNICO", ativo: true });
  AlertaModel.findById = async () => ({ id: 10, status: "RESOLVIDO" });

  await assert.rejects(
    () => ManutencaoService.create({ alertaId: "10", usuarioId: "7", observacao: "ok ok" }),
    (error) => error.name === "AppError" && error.statusCode === 400
  );

  AlertaModel.findById = async () => ({ id: 10, status: "ATIVO" });
  ManutencaoModel.findByAlertaId = async () => [{ id: 2, status: "EM_ANDAMENTO" }];

  await assert.rejects(
    () => ManutencaoService.create({ alertaId: "10", usuarioId: "7", observacao: "ok ok" }),
    (error) => error.name === "AppError" && error.statusCode === 400
  );
});

test("create preventiva bloqueia maquina inexistente ou inativa", async () => {
  UsuarioModel.findById = async () => ({ id: 7, role: "TECNICO", ativo: true });
  MaquinaModel.findById = async () => null;

  await assert.rejects(
    () => ManutencaoService.create({ tipo: "PREVENTIVA", maquinaId: "22", usuarioId: "7", observacao: "ok ok" }),
    (error) => error.name === "AppError" && error.statusCode === 404
  );

  MaquinaModel.findById = async () => ({ id: 22, ativo: false });

  await assert.rejects(
    () => ManutencaoService.create({ tipo: "PREVENTIVA", maquinaId: "22", usuarioId: "7", observacao: "ok ok" }),
    (error) => error.name === "AppError" && error.statusCode === 400
  );
});

test("create bloqueia usuario inativo", async () => {
  UsuarioModel.findById = async () => ({ id: 7, ativo: false });

  await assert.rejects(
    () => ManutencaoService.create({ alertaId: "10", usuarioId: "7", observacao: "ok ok" }),
    (error) => error.name === "AppError" && error.statusCode === 400
  );
});

test("list filtra apenas preventivas para tecnico e lista tudo para admin", async () => {
  const chamadas = [];
  ManutencaoModel.findAll = async (payload) => {
    chamadas.push(["findAll", payload]);
    return [];
  };
  ManutencaoModel.count = async (where) => {
    chamadas.push(["count", where]);
    return 0;
  };

  await ManutencaoService.list({ page: "1", limit: "5", usuario: { role: "TECNICO" } });
  await ManutencaoService.list({ page: "1", limit: "5", usuario: { role: "ADMIN" } });

  assert.deepEqual(chamadas, [
    ["findAll", { skip: 0, take: 5, where: { tipo: "PREVENTIVA" } }],
    ["count", { tipo: "PREVENTIVA" }],
    ["findAll", { skip: 0, take: 5, where: {} }],
    ["count", {}]
  ]);
});

test("update valida responsavel e envia apenas campos normalizados", async () => {
  ManutencaoModel.findById = async () => ({
    id: 5,
    alertaId: 10,
    maquinaId: 55,
    tipo: "CORRETIVA",
    usuarioId: 7,
    status: "EM_ANDAMENTO",
    alerta: { maquinaId: 55 }
  });
  UsuarioModel.findById = async () => ({ id: 7, role: "TECNICO", ativo: true });

  let payloadRecebido;
  let maquinaResetada = null;
  ManutencaoModel.updateWithAlertSync = async (payload) => {
    payloadRecebido = payload;
    return { id: payload.manutencaoId, ...payload.dados };
  };
  simuladorJob.resetarMaquinaSimulada = (maquinaId) => {
    maquinaResetada = maquinaId;
    return true;
  };

  const result = await ManutencaoService.update("5", "7", {
    dados: {
      observacao: "  resolvido no local  ",
      status: "RESOLVIDO"
    }
  });

  assert.deepEqual(payloadRecebido, {
    manutencaoId: 5,
    alertaId: 10,
    usuarioId: 7,
    dados: {
      observacao: "resolvido no local",
      status: "RESOLVIDO",
      concluidaEm: payloadRecebido?.dados?.concluidaEm,
      cumprimentoAgendamento: "NAO_APLICAVEL"
    }
  });
  assert.equal(result.status, "RESOLVIDO");
  assert.equal(maquinaResetada, 55);
});

test("update preventiva nao sincroniza alerta e reseta maquina da manutencao", async () => {
  ManutencaoModel.findById = async () => ({
    id: 5,
    alertaId: null,
    maquinaId: 22,
    tipo: "PREVENTIVA",
    usuarioId: 7,
    status: "EM_ANDAMENTO",
    alerta: null
  });
  UsuarioModel.findById = async () => ({ id: 7, role: "TECNICO", ativo: true });

  let payloadRecebido;
  let maquinaResetada = null;
  ManutencaoModel.updatePreventiva = async (payload) => {
    payloadRecebido = payload;
    return { id: payload.manutencaoId, tipo: "PREVENTIVA", ...payload.dados };
  };
  ManutencaoModel.updateWithAlertSync = async () => {
    throw new Error("nao deveria sincronizar alerta");
  };
  simuladorJob.resetarMaquinaSimulada = (maquinaId) => {
    maquinaResetada = maquinaId;
    return true;
  };

  const result = await ManutencaoService.update("5", "7", {
    dados: {
      observacao: "  revisao finalizada  ",
      status: "RESOLVIDO"
    }
  });

  assert.deepEqual(payloadRecebido, {
    manutencaoId: 5,
    dados: {
      observacao: "revisao finalizada",
      status: "RESOLVIDO",
      concluidaEm: payloadRecebido?.dados?.concluidaEm,
      cumprimentoAgendamento: "NAO_APLICAVEL"
    }
  });
  assert.equal(result.status, "RESOLVIDO");
  assert.equal(maquinaResetada, 22);
});

test("update bloqueia manutencao encerrada, outro tecnico e payload vazio", async () => {
  ManutencaoModel.findById = async () => ({ id: 5, usuarioId: 7, status: "RESOLVIDO" });

  await assert.rejects(
    () => ManutencaoService.update("5", "7", { dados: { observacao: "nova obs" } }),
    (error) => error.name === "AppError" && error.statusCode === 409
  );

  ManutencaoModel.findById = async () => ({
    id: 5,
    alertaId: 10,
    usuarioId: 7,
    status: "EM_ANDAMENTO"
  });
  UsuarioModel.findById = async () => ({ id: 8, role: "TECNICO", ativo: true });

  await assert.rejects(
    () => ManutencaoService.update("5", "8", { dados: { observacao: "nova obs" } }),
    (error) => error.name === "AppError" && error.statusCode === 403
  );

  UsuarioModel.findById = async () => ({ id: 7, role: "TECNICO", ativo: true });

  await assert.rejects(
    () => ManutencaoService.update("5", "7", { dados: {} }),
    (error) => error.name === "AppError" && error.statusCode === 400
  );
});

test("update inicia preventiva preditiva agendada sem tecnico responsavel", async () => {
  ManutencaoModel.findById = async () => ({
    id: 5,
    alertaId: null,
    maquinaId: 22,
    tipo: "PREVENTIVA",
    origem: "PREDICAO",
    usuarioId: null,
    status: "AGENDADA",
    dataAgendada: new Date(Date.now() + 86400000).toISOString(),
    alerta: null
  });
  UsuarioModel.findById = async () => ({ id: 7, role: "TECNICO", ativo: true });

  let payloadRecebido;
  ManutencaoModel.updatePreventiva = async (payload) => {
    payloadRecebido = payload;
    return { id: payload.manutencaoId, tipo: "PREVENTIVA", ...payload.dados };
  };

  const result = await ManutencaoService.update("5", "7", {
    dados: { status: "EM_ANDAMENTO" }
  });

  assert.deepEqual(payloadRecebido, {
    manutencaoId: 5,
    dados: {
      status: "EM_ANDAMENTO",
      usuarioId: 7
    }
  });
  assert.equal(result.usuarioId, 7);
  assert.equal(result.status, "EM_ANDAMENTO");
});

test("update calcula cumprimento de preventiva agendada resolvida no prazo", async () => {
  const dataAgendada = "2026-06-20T10:00:00.000Z";
  ManutencaoModel.findById = async () => ({
    id: 5,
    alertaId: null,
    maquinaId: 22,
    tipo: "PREVENTIVA",
    usuarioId: 7,
    status: "EM_ANDAMENTO",
    dataAgendada,
    alerta: null
  });
  UsuarioModel.findById = async () => ({ id: 7, role: "TECNICO", ativo: true });

  let payloadRecebido;
  ManutencaoModel.updatePreventiva = async (payload) => {
    payloadRecebido = payload;
    return {
      id: payload.manutencaoId,
      tipo: "PREVENTIVA",
      dataAgendada,
      ...payload.dados
    };
  };

  const originalBuildConcludedFields = ManutencaoService.buildConcludedFields;
  ManutencaoService.buildConcludedFields = () => ({
    concluidaEm: new Date("2026-06-20T18:00:00.000Z"),
    cumprimentoAgendamento: "NO_PRAZO"
  });

  try {
    const result = await ManutencaoService.update("5", "7", {
      dados: { status: "RESOLVIDO", observacao: "finalizada" }
    });

    assert.equal(payloadRecebido.dados.cumprimentoAgendamento, "NO_PRAZO");
    assert.equal(result.cumprimentoAgendamento, "NO_PRAZO");
    assert.equal(result.diasDesvioAgendamento, 0);
  } finally {
    ManutencaoService.buildConcludedFields = originalBuildConcludedFields;
  }
});

function buildAvaliacaoModelo({ r2 = 0.86, pontosUsados = 6 } = {}) {
  return {
    modeloIntegridade: {
      score: { r2 },
      slope: -1.25,
      intercept: 100,
      pontosUsados,
      janelaHorasCoberta: 6,
      ultimoPontoEm: "2026-06-20T10:00:00.000Z"
    }
  };
}

function buildDiagnosticoPreditivo({
  maquina,
  estadoPredicao = "PREVISAO_VALIDA",
  motivo = "previsao_linear_valida",
  inicio = "2026-06-25T10:00:00.000Z",
  fim = "2026-06-26T10:00:00.000Z",
  falha = "2026-06-30T10:00:00.000Z",
  r2 = 0.86,
  pontosUsados = 6
}) {
  return {
    maquina,
    estadoPredicao,
    fonteDecisao: estadoPredicao === "PREVISAO_VALIDA" ? "REGRESSAO_LINEAR" : "SEM_MODELO",
    urgencia: "ALTA",
    motivo,
    dataFalha: falha ? new Date(falha) : null,
    janelaManuInicio: inicio ? new Date(inicio) : null,
    janelaManuFim: fim ? new Date(fim) : null,
    avaliacaoModelo: buildAvaliacaoModelo({ r2, pontosUsados })
  };
}

function mockSyncPredicao({ maquina, existente = null, preventivaManualProxima = null }) {
  const chamadas = [];
  let manutencaoExistente = existente;

  MaquinaModel.update = async (id, data) => {
    Object.assign(maquina, data);
    return { id, ...maquina };
  };
  ManutencaoModel.findOpenPredictiveByMaquinaId = async () => manutencaoExistente;
  ManutencaoModel.findOpenManualPreventiveNearDate = async () => preventivaManualProxima;
  ManutencaoModel.create = async (payload) => {
    chamadas.push(["create", payload]);
    manutencaoExistente = { id: 1, ...payload };
    return manutencaoExistente;
  };
  ManutencaoModel.update = async ({ id, dados }) => {
    chamadas.push(["update", id, dados]);
    manutencaoExistente = {
      ...manutencaoExistente,
      id,
      ...dados
    };
    return manutencaoExistente;
  };

  return chamadas;
}

test("syncPreventivaPreditiva nao cria na primeira e segunda previsao valida", async () => {
  const maquina = { id: 22, nome: "Esteira" };
  const chamadas = mockSyncPredicao({ maquina });

  const primeira = await ManutencaoService.syncPreventivaPreditiva(buildDiagnosticoPreditivo({ maquina }));
  const segunda = await ManutencaoService.syncPreventivaPreditiva(buildDiagnosticoPreditivo({ maquina }));

  assert.equal(primeira, null);
  assert.equal(segunda, null);
  assert.equal(chamadas.length, 0);
  assert.equal(maquina.estadoPredicaoManutencao.validasConsecutivas, 2);
});

test("syncPreventivaPreditiva cria manutencao na terceira previsao valida consecutiva", async () => {
  const maquina = { id: 22, nome: "Esteira" };
  const chamadas = mockSyncPredicao({ maquina });

  await ManutencaoService.syncPreventivaPreditiva(buildDiagnosticoPreditivo({ maquina }));
  await ManutencaoService.syncPreventivaPreditiva(buildDiagnosticoPreditivo({ maquina }));
  const criada = await ManutencaoService.syncPreventivaPreditiva(buildDiagnosticoPreditivo({ maquina }));

  assert.equal(criada.status, "AGENDADA");
  assert.equal(criada.tipo, "PREVENTIVA");
  assert.equal(criada.origem, "PREDICAO");
  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0][0], "create");
  assert.equal(chamadas[0][1].metadataPredicao.confirmacoesValidas, 3);
  assert.equal(chamadas[0][1].metadataPredicao.r2, 0.86);
});

test("syncPreventivaPreditiva atualiza estado mas nao cria quando auto agendamento esta desabilitado", async () => {
  const maquina = { id: 22, nome: "Esteira" };
  const chamadas = mockSyncPredicao({ maquina });
  const previous = process.env.PREDICAO_AUTO_AGENDAR_ENABLED;
  process.env.PREDICAO_AUTO_AGENDAR_ENABLED = "false";

  try {
    await ManutencaoService.syncPreventivaPreditiva(buildDiagnosticoPreditivo({ maquina }));
    await ManutencaoService.syncPreventivaPreditiva(buildDiagnosticoPreditivo({ maquina }));
    const resultado = await ManutencaoService.syncPreventivaPreditiva(buildDiagnosticoPreditivo({ maquina }));

    assert.equal(resultado, null);
    assert.equal(chamadas.length, 0);
    assert.equal(maquina.estadoPredicaoManutencao.validasConsecutivas, 3);
  } finally {
    if (previous === undefined) {
      delete process.env.PREDICAO_AUTO_AGENDAR_ENABLED;
    } else {
      process.env.PREDICAO_AUTO_AGENDAR_ENABLED = previous;
    }
  }
});

test("syncPreventivaPreditiva reseta contagem quando ocorre estado SEM_DADOS entre previsoes validas", async () => {
  const maquina = { id: 22, nome: "Esteira" };
  const chamadas = mockSyncPredicao({ maquina });

  await ManutencaoService.syncPreventivaPreditiva(buildDiagnosticoPreditivo({ maquina }));
  await ManutencaoService.syncPreventivaPreditiva(buildDiagnosticoPreditivo({ maquina }));
  await ManutencaoService.syncPreventivaPreditiva(buildDiagnosticoPreditivo({
    maquina,
    estadoPredicao: "SEM_DADOS",
    motivo: "historico_insuficiente",
    inicio: null,
    fim: null,
    falha: null
  }));
  await ManutencaoService.syncPreventivaPreditiva(buildDiagnosticoPreditivo({ maquina }));

  assert.equal(chamadas.length, 0);
  assert.equal(maquina.estadoPredicaoManutencao.validasConsecutivas, 1);
});

test("syncPreventivaPreditiva reseta contagem quando data candidata muda mais de 24h", async () => {
  const maquina = { id: 22, nome: "Esteira" };
  const chamadas = mockSyncPredicao({ maquina });

  await ManutencaoService.syncPreventivaPreditiva(buildDiagnosticoPreditivo({
    maquina,
    inicio: "2026-06-25T10:00:00.000Z"
  }));
  await ManutencaoService.syncPreventivaPreditiva(buildDiagnosticoPreditivo({
    maquina,
    inicio: "2026-06-26T11:30:00.000Z"
  }));

  assert.equal(chamadas.length, 0);
  assert.equal(maquina.estadoPredicaoManutencao.validasConsecutivas, 1);
  assert.equal(maquina.estadoPredicaoManutencao.ultimoMotivo, "data_prevista_alterada_acima_da_tolerancia");
});

test("syncPreventivaPreditiva bloqueia criacao quando ha preventiva manual proxima", async () => {
  const maquina = { id: 22, nome: "Esteira" };
  const chamadas = mockSyncPredicao({
    maquina,
    preventivaManualProxima: {
      id: 88,
      status: "AGENDADA",
      origem: "MANUAL",
      tipo: "PREVENTIVA",
      dataAgendada: new Date("2026-06-24T10:00:00.000Z")
    }
  });

  await ManutencaoService.syncPreventivaPreditiva(buildDiagnosticoPreditivo({ maquina }));
  await ManutencaoService.syncPreventivaPreditiva(buildDiagnosticoPreditivo({ maquina }));
  const resultado = await ManutencaoService.syncPreventivaPreditiva(buildDiagnosticoPreditivo({ maquina }));

  assert.equal(resultado, null);
  assert.equal(chamadas.length, 0);
  assert.equal(maquina.estadoPredicaoManutencao.bloqueadaPorPreventivaManual, true);
  assert.deepEqual(maquina.estadoPredicaoManutencao.criteriosReprovados, ["preventivaManualProxima"]);
});

test("syncPreventivaPreditiva cria quando preventiva manual esta fora da janela de bloqueio", async () => {
  const maquina = { id: 22, nome: "Esteira" };
  const chamadas = mockSyncPredicao({ maquina, preventivaManualProxima: null });

  await ManutencaoService.syncPreventivaPreditiva(buildDiagnosticoPreditivo({ maquina }));
  await ManutencaoService.syncPreventivaPreditiva(buildDiagnosticoPreditivo({ maquina }));
  const criada = await ManutencaoService.syncPreventivaPreditiva(buildDiagnosticoPreditivo({ maquina }));

  assert.equal(criada.status, "AGENDADA");
  assert.equal(chamadas[0][0], "create");
});

test("syncPreventivaPreditiva nao reagenda existente quando diferenca e menor que 24h", async () => {
  const maquina = {
    id: 22,
    nome: "Esteira",
    estadoPredicaoManutencao: {
      validasConsecutivas: 2,
      ultimaDataAgendada: "2026-06-25T10:00:00.000Z"
    }
  };
  const existente = {
    id: 1,
    maquinaId: 22,
    status: "AGENDADA",
    tipo: "PREVENTIVA",
    origem: "PREDICAO",
    dataAgendada: new Date("2026-06-25T10:00:00.000Z"),
    metadataPredicao: {}
  };
  const chamadas = mockSyncPredicao({ maquina, existente });

  const atualizada = await ManutencaoService.syncPreventivaPreditiva(buildDiagnosticoPreditivo({
    maquina,
    inicio: "2026-06-25T20:00:00.000Z"
  }));

  assert.equal(atualizada.id, 1);
  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0][0], "update");
  assert.equal(Object.prototype.hasOwnProperty.call(chamadas[0][2], "dataAgendada"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(chamadas[0][2], "janelaAgendadaInicio"), false);
});

test("syncPreventivaPreditiva atualiza existente quando diferenca e maior ou igual a 24h", async () => {
  const maquina = {
    id: 22,
    nome: "Esteira",
    estadoPredicaoManutencao: {
      validasConsecutivas: 2,
      ultimaDataAgendada: "2026-06-24T10:00:00.000Z"
    }
  };
  const existente = {
    id: 1,
    maquinaId: 22,
    status: "AGENDADA",
    tipo: "PREVENTIVA",
    origem: "PREDICAO",
    dataAgendada: new Date("2026-06-24T10:00:00.000Z"),
    metadataPredicao: {}
  };
  const chamadas = mockSyncPredicao({ maquina, existente });

  await ManutencaoService.syncPreventivaPreditiva(buildDiagnosticoPreditivo({
    maquina,
    inicio: "2026-06-25T10:00:00.000Z"
  }));

  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0][0], "update");
  assert.equal(chamadas[0][2].dataAgendada.toISOString(), "2026-06-25T10:00:00.000Z");
});

test("syncPreventivaPreditiva nao altera preditiva em andamento", async () => {
  const maquina = {
    id: 22,
    nome: "Esteira",
    estadoPredicaoManutencao: {
      validasConsecutivas: 2,
      ultimaDataAgendada: "2026-06-25T10:00:00.000Z"
    }
  };
  const existente = {
    id: 1,
    maquinaId: 22,
    status: "EM_ANDAMENTO",
    tipo: "PREVENTIVA",
    origem: "PREDICAO",
    dataAgendada: new Date("2026-06-25T10:00:00.000Z"),
    metadataPredicao: {}
  };
  const chamadas = mockSyncPredicao({ maquina, existente });

  const preservada = await ManutencaoService.syncPreventivaPreditiva(buildDiagnosticoPreditivo({ maquina }));

  assert.equal(preservada.id, 1);
  assert.equal(preservada.status, "EM_ANDAMENTO");
  assert.equal(chamadas.length, 0);
});
