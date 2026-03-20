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

}



module.exports = LeituraModel