const cron = require('node-cron')
const prisma = require('../prisma/prisma')
const AlertaService = require('../services/alertaService')

// Análise de Tendências e Saúde a cada 30min
cron.schedule('*/30 * * * *', async () => {
    console.log("Executando análise de TENDÊNCIAS e HEALTH SCORE...")

    const sensores = await prisma.sensor.findMany({
        where: { status: 'ONLINE' },
        include: { maquina: true }
    })

    for (const sensor of sensores) {
        const agora = Date.now()

        const media2h = await calcularMedia(sensor.id, agora - (2 * 60 * 60 * 1000))
        const media24h = await calcularMedia(sensor.id, agora - (24 * 60 * 60 * 1000))
        const media7d = await calcularMedia(sensor.id, agora - (168 * 60 * 60 * 1000))

        if (media2h > media24h * 1.15 && media24h > 0) {
            await AlertaService.gerarAlerta(
                sensor.id,
                sensor.maquinaId,
                'TENDENCIA_CURTA',
                `Aumento repentino de 15% na vibração nas ultimas 2h: Média ${media2h.toFixed(2)}`
            )
        }

        if (media24h > media7d * 1.15 && media7d > 0) {
            await AlertaService.gerarAlerta(
                sensor.id,
                sensor.maquinaId,
                'TENDENCIA_LONGA',
                `Aumento de 15% na vibração nas ultimas 24h: Média ${media24h.toFixed(2)}`
            )
            await prisma.maquina.update({
                where: { id: sensor.maquinaId },
                data: {
                    scoreEstabilidade: { decrement: 10 },
                    integridade: { decrement: 5 }
                }
            })
        }

    }

})

async function calcularMedia(sensorId, dataInicio) {
    const resultado = await prisma.leitura.aggregate({
        _avg: { vibracao: true },
        where: { sensorId, criadoEm: { gte: new Date(dataInicio) } }
    })
    return resultado._avg.vibracao || 0
}

// Sensor Offline 5min
cron.schedule('*/5 * * * *', async () => {
    const cincoMinAtras = new Date(Date.now() - 5 * 60 * 1000)

    await prisma.sensor.updateMany({
        where: { status: 'ONLINE', ultimaLeituraEm: { lt: cincoMinAtras } },
        data: { status: 'OFFLINE' }
    })
})