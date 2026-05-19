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
const CICLOS_ESTAVEIS_INICIAIS = 5;

const sensoresEmSimulacao = new Map();
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

function escolherItemAleatorio(itens) {
  return itens[Math.floor(Math.random() * itens.length)];
}

function calcularFaixaSegura(sensor, campoIdeal, campoLimite, campoDesvio) {
  const ideal = Number(sensor[campoIdeal]);
  const limite = Number(sensor[campoLimite]);
  const desvioMaximo = Number(sensor[campoDesvio]);
  const idealSeguro = Number.isFinite(ideal) ? ideal : 0;
  const distanciaAteLimite = Number.isFinite(limite) && limite > idealSeguro
    ? limite - idealSeguro
    : Number.POSITIVE_INFINITY;
  const distanciaAteDesvio = Number.isFinite(desvioMaximo) && desvioMaximo > 0
    ? desvioMaximo
    : distanciaAteLimite;
  const margemSegura = Math.min(distanciaAteLimite, distanciaAteDesvio) * 0.7;

  return {
    ideal: idealSeguro,
    maximoSeguro: idealSeguro + (Number.isFinite(margemSegura) ? margemSegura : 0)
  };
}

function gerarValorEstavelComDegradacao(sensor, estado, configuracao) {
  const { ideal, maximoSeguro } = calcularFaixaSegura(
    sensor,
    configuracao.campoIdeal,
    configuracao.campoLimite,
    configuracao.campoDesvio
  );
  const faixaSegura = Math.max(maximoSeguro - ideal, 0);
  const ciclosDegradando = Math.max(0, estado.ciclos - CICLOS_ESTAVEIS_INICIAIS);
  const progresso = limitar(ciclosDegradando / CICLOS_ATE_DEGRADACAO_MAXIMA, 0, 1);
  const degradacao = faixaSegura * progresso;
  const ruidoPercentual = estado.ciclos < CICLOS_ESTAVEIS_INICIAIS
    ? configuracao.ruidoPercentualInicial
    : configuracao.ruidoPercentual;
  const ruidoMinimo = estado.ciclos < CICLOS_ESTAVEIS_INICIAIS
    ? configuracao.ruidoMinimoInicial
    : configuracao.ruidoMinimo;
  const ruidoCalculado = Math.max(faixaSegura * ruidoPercentual, ruidoMinimo);
  const ruidoMaximo = faixaSegura > 0
    ? Math.min(ruidoCalculado, faixaSegura * 0.2)
    : 0;
  const ruido = numeroAleatorioEntre(-ruidoMaximo, ruidoMaximo);
  const valor = ideal + degradacao + ruido;
  const minimoSeguro = Math.max(0, ideal - ruidoMaximo);

  return arredondar(limitar(valor, minimoSeguro, maximoSeguro));
}

function gerarLeitura(estado) {
  const sensor = estado.sensor;

  return {
    sensorId: sensor.id,
    temperatura: gerarValorEstavelComDegradacao(sensor, estado, {
      campoIdeal: "idealTemperatura",
      campoLimite: "limiteTemperatura",
      campoDesvio: "desvioMaximoTemp",
      ruidoPercentual: 0.04,
      ruidoMinimo: 0.15,
      ruidoPercentualInicial: 0.005,
      ruidoMinimoInicial: 0
    }),
    vibracao: gerarValorEstavelComDegradacao(sensor, estado, {
      campoIdeal: "idealVibracao",
      campoLimite: "limiteVibracao",
      campoDesvio: "desvioMaximoVibra",
      ruidoPercentual: 0.04,
      ruidoMinimo: 0.03,
      ruidoPercentualInicial: 0.005,
      ruidoMinimoInicial: 0
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

  for (const sensor of sensoresDisponiveis) {
    if (!sensoresEmSimulacao.has(sensor.id)) {
      sensoresEmSimulacao.set(sensor.id, {
        sensor,
        ciclos: 0
      });

      logger.info("simulador_sensor_added", {
        sensorId: sensor.id,
        maquinaId: sensor.maquinaId,
        maquinaNome: sensor.maquina?.nome ?? null
      });
    } else {
      sensoresEmSimulacao.get(sensor.id).sensor = sensor;
    }
  }

  for (const sensorId of sensoresEmSimulacao.keys()) {
    if (!sensoresDisponiveis.some((sensor) => sensor.id === sensorId)) {
      sensoresEmSimulacao.delete(sensorId);
    }
  }

  return sensoresDisponiveis.length;
}

async function processarLeituraSimulada(estado, forcarAlerta = false) {
  const sensor = estado.sensor;
  const dadosLeitura = forcarAlerta ? gerarLeituraComAlerta(sensor) : gerarLeitura(estado);
  const novaLeitura = await leituraService.processarNovaLeitura(dadosLeitura);

  estado.ciclos += 1;

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

    if (sensoresEmSimulacao.size === 0) {
      logger.info("simulador_cycle_finished", {
        sensoresDisponiveis,
        leiturasGeradas: 0,
        durationMs: Date.now() - startedAt
      });
      return;
    }

    let leiturasGeradas = 0;
    const estadoAleatorio = escolherItemAleatorio([...sensoresEmSimulacao.values()]);

    try {
      await processarLeituraSimulada(estadoAleatorio, deveForcarAlertas());
      leiturasGeradas += 1;
    } catch (error) {
      logger.error("simulador_sensor_processing_error", {
        sensorId: estadoAleatorio.sensor.id,
        maquinaId: estadoAleatorio.sensor.maquinaId,
        maquinaNome: estadoAleatorio.sensor.maquina?.nome ?? null,
        error
      });
    }

    logger.info("simulador_cycle_finished", {
      sensoresDisponiveis,
      leiturasGeradas,
      sensorAleatorioId: estadoAleatorio.sensor.id,
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
  simularCiclo
};
