const prisma = require('../prisma/prisma')

class LeituraModel {

    static async store(dados) {
        const sensorId = Number(dados.sensorId);
        const temperatura = Number(dados.temperatura);
        const vibracao = Number(dados.vibracao);
        const agora = new Date();

        const [novaLeitura] = await prisma.$transaction([
            prisma.leitura.create({
                data: {
                    sensorId,
                    temperatura,
                    vibracao
                }
            }),
            prisma.sensor.update({
                where: { id: sensorId },
                data: {
                    status: "ONLINE",
                    ultimaTemperatura: temperatura,
                    ultimaVibracao: vibracao,
                    ultimaLeituraEm: agora
                }
            })
        ]);

        return novaLeitura;
    }

    static async index(limite) {
        return await prisma.leitura.findMany({
            take: limite,
            orderBy: { criadoEm: 'desc' },
        })
    }


    static async findUnique(maquinaId, date) {
        return await prisma.leitura.findFirst({
            where: {
                sensor: {maquinaId: maquinaId},
                criadoEm: {gte: date}
            },
            include: {sensor: true},
            orderBy: {criadoEm: 'asc'}
        })
    }

    static async findByMaquinaPeriodo(maquinaId, { dataInicio, dataFim } = {}) {
        const where = {
            sensor: {
                maquinaId: Number(maquinaId)
            }
        };

        if (dataInicio || dataFim) {
            where.criadoEm = {};

            if (dataInicio) {
                where.criadoEm.gte = new Date(dataInicio);
            }

            if (dataFim) {
                where.criadoEm.lte = new Date(dataFim);
            }
        }

        return await prisma.leitura.findMany({
            where,
            include: {
                sensor: {
                    select: {
                        id: true,
                        tipo: true,
                        limiteTemperatura: true,
                        idealTemperatura: true,
                        limiteVibracao: true,
                        idealVibracao: true,
                        desvioMaximoTemp: true,
                        desvioMaximoVibra: true
                    }
                }
            },
            orderBy: { criadoEm: 'asc' }
        });
    }

    static async limpeza(trintaDiasAtras){
        return await prisma.leitura.deleteMany({
            where: { criadoEm: { lt: trintaDiasAtras }}
        })
    }
}



module.exports = LeituraModel
