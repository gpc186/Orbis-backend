const prisma = require('../prisma/prisma')

class SensorModel {
    static async create(data) {
        const sensorData = {
            tipo: data.tipo,
            limiteTemperatura: parseFloat(data.limiteTemperatura),
            idealTemperatura: parseFloat(data.idealTemperatura),
            limiteVibracao: parseFloat(data.limiteVibracao),
            idealVibracao: parseFloat(data.idealVibracao),
            maquina: {
                connect: { id: parseInt(data.maquinaId) }
            }
        };

        if (data.status) sensorData.status = data.status;
        if (data.desvioMaximoTemp !== undefined) {
            sensorData.desvioMaximoTemp = parseFloat(data.desvioMaximoTemp);
        }
        if (data.desvioMaximoVibra !== undefined) {
            sensorData.desvioMaximoVibra = parseFloat(data.desvioMaximoVibra);
        }

        return await prisma.sensor.create({
            data: sensorData
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
                idealTemperatura: data.idealTemperatura !== undefined ? parseFloat(data.idealTemperatura) : undefined,
                limiteVibracao: parseFloat(data.limiteVibracao),
                idealVibracao: data.idealVibracao !== undefined ? parseFloat(data.idealVibracao) : undefined,
                desvioMaximoTemp: data.desvioMaximoTemp !== undefined ? parseFloat(data.desvioMaximoTemp) : undefined,
                desvioMaximoVibra: data.desvioMaximoVibra !== undefined ? parseFloat(data.desvioMaximoVibra) : undefined,
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
                idealTemperatura: data.idealTemperatura ? parseFloat(data.idealTemperatura) : undefined,
                limiteVibracao: data.limiteVibracao ? parseFloat(data.limiteVibracao) : undefined,
                idealVibracao: data.idealVibracao ? parseFloat(data.idealVibracao) : undefined,
                desvioMaximoTemp: data.desvioMaximoTemp ? parseFloat(data.desvioMaximoTemp) : undefined,
                desvioMaximoVibra: data.desvioMaximoVibra ? parseFloat(data.desvioMaximoVibra) : undefined,
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

    static async listOfflineRecentes({ limit = 5 } = {}) {
        const safeLimit = Number(limit) > 0 ? Number(limit) : 5;

        return prisma.sensor.findMany({
            where: { status: "OFFLINE" }, 
            orderBy: { ultimaLeituraEm: "desc" },
            take: safeLimit,
            select: {
                id: true,
                maquinaId: true,
                status: true,
                ultimaLeituraEm: true,
            }
        });
    }
}

module.exports = SensorModel
