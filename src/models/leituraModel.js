const prisma = require('../prisma/prisma')

class LeituraModel {

    static async store(dados) {
        return await prisma.leitura.create({
            data: {
                sensorId: Number(dados.sensorId),
                temperatura: Number(dados.temperatura),
                vibracao: Number(dados.vibracao)
            }
        })
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

    static async limpeza(trintaDiasAtras){
        return await prisma.leitura.deleteMany({
            where: { criadoEm: { lt: trintaDiasAtras }}
        })
    }
}



module.exports = LeituraModel