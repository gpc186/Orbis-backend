const prisma = require('../prisma/prisma')

class AlertaModel {
    static async create(sensorId, maquinaId, tipo, mensagem) {
        return await prisma.alerta.create({
            data: {
                sensorId,
                maquinaId,
                tipo,
                mensagem,
                status: 'ATIVO'
            }
        })
    }

    static async update(id, data) {
        return await prisma.alerta.update({
            where: { id: parseInt(id) },
            data
        })
    }

    static async findAtivo(sensorId, tipo) {
        return await prisma.alerta.findFirst({
            where: {
                sensorId,
                tipo,
                status: 'ATIVO'
            }
        })
    }

    static async findAll() {
        return await prisma.alerta.findMany({
            include: {
                sensor: true,
                maquina: true,
                tecnico: { select: { nome: true } }
            },
            orderBy: { criadoEm: 'desc' }
        });
    }

}



module.exports = AlertaModel