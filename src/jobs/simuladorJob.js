const cron = require("node-cron");
const prisma = require("../prisma/prisma");
const leituraService = require("../services/leituraService");
const logger = require("../utils/logger");

const intervaloConfigurado = Number(process.env.SIMULADOR_INTERVALO_MS);
const INTERVALO_MS = Number.isFinite(intervaloConfigurado) && intervaloConfigurado > 0
  ? intervaloConfigurado
  : 5000;
const INTERVALO_SEGUNDOS = Math.max(1, Math.round(INTERVALO_MS / 1000));
const EXPRESSAO_CRON = criarExpressaoCron(INTERVALO_SEGUNDOS);
const degradacaoHorasConfigurada = Number(process.env.SIMULADOR_DEGRADACAO_HORAS);
const DEGRADACAO_HORAS = Number.isFinite(degradacaoHorasConfigurada) && degradacaoHorasConfigurada > 0
  ? degradacaoHorasConfigurada
  : 24;
const CICLOS_ATE_DEGRADACAO_MAXIMA = Math.max(
  1,
  Math.ceil((DEGRADACAO_HORAS * 60 * 60 * 1000) / INTERVALO_MS)
);
const ruidoPercentualConfigurado = Number(process.env.SIMULADOR_RUIDO_PERCENTUAL);
const RUIDO_PERCENTUAL = Number.isFinite(ruidoPercentualConfigurado) && ruidoPercentualConfigurado >= 0
  ? ruidoPercentualConfigurado
  : 0.01;

const maquinasEmSimulacao = new Map();
let cicloEmAndamento = false;
let ioServer = null;
let jobAgendado = null;

function criarExpressaoCron(intervaloSegundos) {
  if (intervaloSegundos < 60) {
    return `*/${intervaloSegundos} * * * * *`;
  }

  const intervaloMinutos = Math.max(1, Math.round(intervaloSegundos / 60));
  return `0 */${intervaloMinutos} * * * *`;
}

function simuladorEstaAtivo() {
  return process.env.SIMULADOR_JOB_ATIVO !== "false";
}

function deveForcarAlertas() {
  return process.env.SIMULADOR_FORCAR_ALERTAS === "true";
}

function numeroAleatorioEntre(min, max) {
  return Math.random() * (max - min) + min;
}

function arredondar(valor) {
  return Number(valor.toFixed(2));
}

function limitar(valor, minimo, maximo) {
  return Math.min(Math.max(valor, minimo), maximo);
}

function calcularFaixaDegradacao(sensor, campoIdeal, campoLimite) {
  const ideal = Number(sensor[campoIdeal]);
  const limite = Number(sensor[campoLimite]);
  const idealSeguro = Number.isFinite(ideal) ? ideal : 0;
  const limiteSeguro = Number.isFinite(limite) && limite > idealSeguro
    ? limite
    : idealSeguro;

  return {
    ideal: idealSeguro,
    limite: limiteSeguro,
    amplitude: Math.max(limiteSeguro - idealSeguro, 0)
  };
}

function gerarValorLinearComDegradacao(sensor, estadoMaquina, configuracao) {
  const { ideal, limite, amplitude } = calcularFaixaDegradacao(
    sensor,
    configuracao.campoIdeal,
    configuracao.campoLimite
  );
  const progresso = limitar(estadoMaquina.ciclos / CICLOS_ATE_DEGRADACAO_MAXIMA, 0, 1);
  const degradacao = amplitude * progresso;
  const ruidoMaximo = amplitude * RUIDO_PERCENTUAL;
  const ruido = numeroAleatorioEntre(-ruidoMaximo, ruidoMaximo);
  const valor = ideal + degradacao + ruido;

  return arredondar(limitar(valor, ideal, limite));
}

function gerarLeitura(sensor, estadoMaquina) {

  return {
    sensorId: sensor.id,
    temperatura: gerarValorLinearComDegradacao(sensor, estadoMaquina, {
      campoIdeal: "idealTemperatura",
      campoLimite: "limiteTemperatura"
    }),
    vibracao: gerarValorLinearComDegradacao(sensor, estadoMaquina, {
      campoIdeal: "idealVibracao",
      campoLimite: "limiteVibracao"
    })
  };
}

function gerarValorAcimaDoLimite(sensor, campoIdeal, campoLimite, campoDesvio, incrementoMinimo) {
  const ideal = Number(sensor[campoIdeal]);
  const limite = Number(sensor[campoLimite]);
  const desvioMaximo = Number(sensor[campoDesvio]);
  const idealSeguro = Number.isFinite(ideal) ? ideal : 0;
  const base = Number.isFinite(limite) && limite > idealSeguro
    ? limite
    : idealSeguro + (Number.isFinite(desvioMaximo) && desvioMaximo > 0 ? desvioMaximo : incrementoMinimo);
  const incremento = Math.max(Math.abs(base) * 0.08, incrementoMinimo);

  return arredondar(base + incremento + numeroAleatorioEntre(0, incremento));
}

function gerarLeituraComAlerta(sensor) {
  return {
    sensorId: sensor.id,
    temperatura: gerarValorAcimaDoLimite(
      sensor,
      "idealTemperatura",
      "limiteTemperatura",
      "desvioMaximoTemp",
      1
    ),
    vibracao: gerarValorAcimaDoLimite(
      sensor,
      "idealVibracao",
      "limiteVibracao",
      "desvioMaximoVibra",
      0.1
    )
  };
}

async function buscarSensoresDisponiveis() {
  return prisma.sensor.findMany({
    where: { status: { not: "INATIVO" } },
    include: { maquina: true },
    orderBy: { id: "asc" }
  });
}

async function atualizarSensoresEmSimulacao() {
  const sensoresDisponiveis = await buscarSensoresDisponiveis();
  const maquinasAtualizadas = new Map();

  for (const sensor of sensoresDisponiveis) {
    if (!maquinasAtualizadas.has(sensor.maquinaId)) {
      const estadoAnterior = maquinasEmSimulacao.get(sensor.maquinaId);
      maquinasAtualizadas.set(sensor.maquinaId, {
        maquina: sensor.maquina,
        ciclos: estadoAnterior?.ciclos ?? 0,
        sensores: []
      });
    }

    maquinasAtualizadas.get(sensor.maquinaId).sensores.push(sensor);
  }

  for (const [maquinaId, estado] of maquinasAtualizadas.entries()) {
    if (!maquinasEmSimulacao.has(maquinaId)) {
      logger.info("simulador_maquina_added", {
        maquinaId,
        maquinaNome: estado.maquina?.nome ?? null,
        sensores: estado.sensores.length
      });
    }
  }

  maquinasEmSimulacao.clear();
  for (const [maquinaId, estado] of maquinasAtualizadas.entries()) {
    maquinasEmSimulacao.set(maquinaId, estado);
  }

  return sensoresDisponiveis.length;
}

async function processarLeituraSimulada(sensor, estadoMaquina, forcarAlerta = false) {
  const dadosLeitura = forcarAlerta ? gerarLeituraComAlerta(sensor) : gerarLeitura(sensor, estadoMaquina);
  const novaLeitura = await leituraService.processarNovaLeitura(dadosLeitura);

  if (ioServer) {
    ioServer.emit("nova-leitura", novaLeitura);
    ioServer.emit("novaLeitura", novaLeitura);
  }

  logger.info("simulador_leitura_generated", {
    sensorId: sensor.id,
    maquinaId: sensor.maquinaId,
    maquinaNome: sensor.maquina?.nome ?? null,
    temperatura: dadosLeitura.temperatura,
    vibracao: dadosLeitura.vibracao
  });

  return novaLeitura;
}

async function processarMaquinaSimulada(estadoMaquina, forcarAlerta = false) {
  let leiturasGeradas = 0;

  for (const sensor of estadoMaquina.sensores) {
    try {
      await processarLeituraSimulada(sensor, estadoMaquina, forcarAlerta);
      leiturasGeradas += 1;
    } catch (error) {
      logger.error("simulador_sensor_processing_error", {
        sensorId: sensor.id,
        maquinaId: sensor.maquinaId,
        maquinaNome: sensor.maquina?.nome ?? null,
        error
      });
    }
  }

  estadoMaquina.ciclos += 1;
  return leiturasGeradas;
}

async function simularCiclo() {
  if (!simuladorEstaAtivo()) {
    return;
  }

  if (cicloEmAndamento) {
    logger.warn("simulador_cycle_skipped", {
      reason: "previous_cycle_in_progress"
    });
    return;
  }

  const startedAt = Date.now();
  cicloEmAndamento = true;

  try {
    logger.info("simulador_cycle_started", {
      intervalMs: INTERVALO_MS,
      cronExpression: EXPRESSAO_CRON
    });

    const sensoresDisponiveis = await atualizarSensoresEmSimulacao();

    if (maquinasEmSimulacao.size === 0) {
      logger.info("simulador_cycle_finished", {
        sensoresDisponiveis,
        leiturasGeradas: 0,
        durationMs: Date.now() - startedAt
      });
      return;
    }

    let leiturasGeradas = 0;
    const estadosMaquinas = [...maquinasEmSimulacao.values()];

    for (const estadoMaquina of estadosMaquinas) {
      leiturasGeradas += await processarMaquinaSimulada(estadoMaquina, deveForcarAlertas());
    }

    logger.info("simulador_cycle_finished", {
      sensoresDisponiveis,
      leiturasGeradas,
      maquinasSimuladas: estadosMaquinas.length,
      forcarAlertas: deveForcarAlertas(),
      durationMs: Date.now() - startedAt
    });
  } catch (error) {
    logger.error("simulador_cycle_error", {
      durationMs: Date.now() - startedAt,
      error
    });
  } finally {
    cicloEmAndamento = false;
  }
}

function iniciarSimuladorJob(io) {
  ioServer = io;

  if (!simuladorEstaAtivo()) {
    logger.info("simulador_job_disabled", {
      reason: "SIMULADOR_JOB_ATIVO=false"
    });
    return null;
  }

  if (jobAgendado) {
    return jobAgendado;
  }

  logger.info("simulador_job_started", {
    cronExpression: EXPRESSAO_CRON,
    intervalMs: INTERVALO_MS,
    degradacaoHoras: DEGRADACAO_HORAS,
    forcarAlertas: deveForcarAlertas()
  });

  jobAgendado = cron.schedule(EXPRESSAO_CRON, simularCiclo);
  return jobAgendado;
}

module.exports = {
  iniciarSimuladorJob,
  simularCiclo,
  _internals: {
    atualizarSensoresEmSimulacao,
    gerarLeitura,
    maquinasEmSimulacao
  }
};
