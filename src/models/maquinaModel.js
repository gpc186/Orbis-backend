const prisma = require('../prisma/prisma');

class MaquinaModel {
    static async create(data) {
        return await prisma.maquina.create({ data });
    }

    static async findAll() {
        return await prisma.maquina.findMany({
            where: { ativo: true },
            include: { sensores: true }
        });
    }

    static async findById(id) {
        return await prisma.maquina.findUnique({
            where: { id: parseInt(id) },
        });
    }

    static async update(id, data) {
        return await prisma.maquina.update({ where: { id: parseInt(id) }, data });
    }

    static async delete(id) {
        return await prisma.maquina.update({
            where: { id: parseInt(id) },
            data: { ativo: false }
        });
    }

    static async count() {
        return await prisma.maquina.count();
    }

    static async calculateAverageIntegrity() {
        return await prisma.maquina.aggregate({
            where: { ativo: true },
            _avg: { integridade: true }
        })
    }

    static async listPioresIntegridade({ limit = 5 } = {}) {
        const safeLimit = Number(limit) > 0 ? Number(limit) : 5;

        return prisma.maquina.findMany({
            where: { ativo: true },
            orderBy: { integridade: "asc" },
            take: safeLimit,
            select: {
                id: true,
                nome: true,
                integridade: true,
                criticidade: true,
                setor: true, 
            }
        });
    }
}


module.exports = MaquinaModel