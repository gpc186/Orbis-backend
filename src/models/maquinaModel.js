const prisma = require('../prisma/prisma');

class MaquinaModel {
    static async create(data) {
        return await prisma.$transaction(async (tx) => {
            const maquina = await tx.maquina.create({ data });

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
            include: { sensores: true }
        });
    }

    static async findById(id, options = {}) {
        return await prisma.maquina.findUnique({
            where: { id: parseInt(id) },
            ...options
        });
    }

    static async findByNome({ nome, take = 10, ativo }) {
        return await prisma.maquina.findMany({
            where: {
                nome: {
                    contains: nome,
                    mode: "insensitive"
                },
                ...(typeof ativo === "boolean" ? { ativo } : {})
            },
            take,
            orderBy: { nome: "asc" },
            select: {
                id: true,
                nome: true,
                setor: true,
                tipo: true,
                criticidade: true,
                ativo: true,
                integridade: true,
                scoreEstabilidade: true,
                previsaoManutencao: true,
                janelaManuInicio: true,
                janelaManuFim: true,
                imagem: true,
                caminhoImagem: true,
                criadoEm: true
            }
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

    static async findComAlertaAtivo({ limit = 10 } = {}) {
        const safeLimit = Number(limit) > 0 ? Number(limit) : 10;

        return prisma.maquina.findMany({
            where: {
                ativo: true,
                alertas: {
                    some: {
                        status: "ATIVO"
                    }
                }
            },
            orderBy: { integridade: "asc" },
            take: safeLimit,
            select: {
                id: true,
                nome: true,
                setor: true,
                tipo: true,
                criticidade: true,
                ativo: true,
                integridade: true,
                scoreEstabilidade: true,
                previsaoManutencao: true,
                janelaManuInicio: true,
                janelaManuFim: true
            }
        });
    }
}


module.exports = MaquinaModel
