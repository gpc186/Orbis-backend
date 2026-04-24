const prisma = require('../prisma/prisma')

class SensorModel {
    static async create(data) {
        return await prisma.sensor.create({
            data: {
                tipo: data.tipo,
                status: data.status,
                limiteTemperatura: parseFloat(data.limiteTemperatura),
                limiteVibracao: parseFloat(data.limiteVibracao),
                maquina: {
                    connect: { id: parseInt(data.maquinaId) }
                }
            }
        })
    }
    static async findAll() {
        return await prisma.sensor.findMany({ include: { maquina: true } })
    }
    static async delete(id) {
        return await prisma.sensor.delete({ where: { id: parseInt(id) } })
    }
    static async findById(id) {
        return await prisma.sensor.findUnique({ where: { id: parseInt(id) } })
    }
    static async update(id, data) {
        return await prisma.sensor.update({
            where: { id: parseInt(id) },
            data: {
                tipo: data.tipo,
                status: data.status,
                limiteTemperatura: parseFloat(data.limiteTemperatura),
                limiteVibracao: parseFloat(data.limiteVibracao),
                maquina: {
                    connect: { id: parseInt(data.maquinaId) }
                }
            }
        });
    }

    static async updateDisconnect(id, data) {
        return await prisma.sensor.update({
            where: { id: parseInt(id) },
            data: {
                tipo: data.tipo,
                status: "INATIVO",
                limiteTemperatura: data.limiteTemperatura ? parseFloat(data.limiteTemperatura) : undefined,
                limiteVibracao: data.limiteVibracao ? parseFloat(data.limiteVibracao) : undefined,
                maquina: {
                    disconnect: true
                }
            }
        });
    }
    static async countActiveSensors() {
        return await prisma.sensor.count({ where: { status: "ONLINE" } })
    }

    static async updateStatus(quinzeSegundosAtras) {
        return await prisma.sensor.updateMany({
            where: {
                AND: [
                    { status: { notIn: ["INATIVO", "OFFLINE"] } },
                    {
                        OR: [
                            { ultimaLeituraEm: { lt: quinzeSegundosAtras } },
                            { ultimaLeituraEm: null }
                        ]
                    }
                ]
            },
            data: { status: "OFFLINE" }
        })
    }
}

module.exports = SensorModel