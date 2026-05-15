const cron = require('node-cron');
const prisma = require('../prisma/prisma');
const leituraService = require('../services/leituraService');

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

function criarExpressaoCron(intervaloSegundos) {
    if (intervaloSegundos < 60) {
        return `*/${intervaloSegundos} * * * * *`;
    }

    const intervaloMinutos = Math.max(1, Math.round(intervaloSegundos / 60));

    return `0 */${intervaloMinutos} * * * *`;
}

function simuladorEstaAtivo() {
    return process.env.SIMULADOR_JOB_ATIVO !== 'false';
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
            campoIdeal: 'idealTemperatura',
            campoLimite: 'limiteTemperatura',
            campoDesvio: 'desvioMaximoTemp',
            ruidoPercentual: 0.04,
            ruidoMinimo: 0.15,
            ruidoPercentualInicial: 0.005,
            ruidoMinimoInicial: 0
        }),
        vibracao: gerarValorEstavelComDegradacao(sensor, estado, {
            campoIdeal: 'idealVibracao',
            campoLimite: 'limiteVibracao',
            campoDesvio: 'desvioMaximoVibra',
            ruidoPercentual: 0.04,
            ruidoMinimo: 0.03,
            ruidoPercentualInicial: 0.005,
            ruidoMinimoInicial: 0
        })
    };
}

async function buscarSensoresOffline() {
    return prisma.sensor.findMany({
        where: { status: 'OFFLINE' },
        include: { maquina: true },
        orderBy: { id: 'asc' }
    });
}

async function atualizarSensoresEmSimulacao() {
    const sensoresOffline = await buscarSensoresOffline();

    for (const sensor of sensoresOffline) {
        if (!sensoresEmSimulacao.has(sensor.id)) {
            sensoresEmSimulacao.set(sensor.id, {
                sensor,
                ciclos: 0
            });
            console.log(`[SIMULADOR] Sensor ${sensor.id} (${sensor.maquina.nome}) entrou na simulacao.`);
        } else {
            sensoresEmSimulacao.get(sensor.id).sensor = sensor;
        }
    }

    return sensoresOffline.length;
}

async function processarLeituraSimulada(estado) {
    const sensor = estado.sensor;
    const dadosLeitura = gerarLeitura(estado);

    await leituraService.processarNovaLeitura(dadosLeitura);
    estado.ciclos += 1;

    console.log(
        `[SIMULADOR] Leitura gerada | Sensor ${sensor.id} - ${sensor.maquina.nome} | ` +
        `Temp: ${dadosLeitura.temperatura}C | Vib: ${dadosLeitura.vibracao}mm/s`
    );
}

async function simularCiclo() {
    if (!simuladorEstaAtivo()) return;

    if (cicloEmAndamento) {
        console.log('[SIMULADOR] Ciclo anterior ainda em andamento. Pulando este intervalo.');
        return;
    }

    cicloEmAndamento = true;

    try {
        await atualizarSensoresEmSimulacao();

        if (sensoresEmSimulacao.size === 0) {
            console.log('[SIMULADOR] Nenhum sensor OFFLINE encontrado.');
            return;
        }

        for (const estado of sensoresEmSimulacao.values()) {
            try {
                await processarLeituraSimulada(estado);
            } catch (err) {
                console.error(`[SIMULADOR] Erro ao gerar leitura do sensor ${estado.sensor.id}: ${err.message}`);
            }
        }
    } catch (err) {
        console.error('[SIMULADOR] Erro no ciclo de simulacao:', err.message);
    } finally {
        cicloEmAndamento = false;
    }
}

if (simuladorEstaAtivo()) {
    console.log(
        `[SIMULADOR] Job ativo a cada ${INTERVALO_SEGUNDOS}s. ` +
        `Degradacao gradual em aproximadamente ${DEGRADACAO_HORAS}h.`
    );

    cron.schedule(EXPRESSAO_CRON, simularCiclo);
} else {
    console.log('[SIMULADOR] Job desativado por SIMULADOR_JOB_ATIVO=false.');
}

module.exports = {
    simularCiclo
};
