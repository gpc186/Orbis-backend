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
    static async findAll(){
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
                // Garante que os números sejam Float e Int
                limiteTemperatura: parseFloat(data.limiteTemperatura),
                limiteVibracao: parseFloat(data.limiteVibracao),
                maquina: {
                    connect: { id: parseInt(data.maquinaId) }
                }
            }
        });
    }
}

module.exports = SensorModel