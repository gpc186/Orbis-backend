const prisma = require('../prisma/prisma');

class MaquinaModel {
    static async create(data) {
        return await prisma.$transaction(async (tx) => {
            const maquina = await tx.maquina.create({
                data,
                include: { manual: true }
            });

            await tx.historicoIntegridade.create({
                data: {
                    maquinaId: maquina.id,
                    integridade: maquina.integridade,
                    scoreEstabilidade: maquina.scoreEstabilidade,
                    origem: "CADASTRO_MAQUINA",
                    observacao: "Registro inicial de integridade."
                }
            });

            return maquina;
        });
    }

    static async findAll() {
        return await prisma.maquina.findMany({
            where: { ativo: true },
            include: { sensores: true, manual: true }
        });
    }

    static async findById(id, options = {}) {
        return await prisma.maquina.findUnique({
            where: { id: parseInt(id) },
            ...options
        });
    }

    static async update(id, data) {
        return await prisma.$transaction(async (tx) => {
            const maquina = await tx.maquina.update({ where: { id: parseInt(id) }, data });

            if (data.integridade !== undefined || data.scoreEstabilidade !== undefined) {
                await tx.historicoIntegridade.create({
                    data: {
                        maquinaId: maquina.id,
                        integridade: maquina.integridade,
                        scoreEstabilidade: maquina.scoreEstabilidade,
                        origem: "ATUALIZACAO_MAQUINA"
                    }
                });
            }

            return maquina;
        });
    }

    static async upsertManual(maquinaId, data) {
        return prisma.maquinaManual.upsert({
            where: { maquinaId: parseInt(maquinaId) },
            create: {
                ...data,
                maquina: {
                    connect: { id: parseInt(maquinaId) }
                }
            },
            update: data
        });
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
