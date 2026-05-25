const prisma = require('../prisma/prisma');

class HistoricoIntegridadeModel {
    static async create(data) {
        return await prisma.historicoIntegridade.create({ data });
    }

    static async findLatestBefore(maquinaId, dataReferencia) {
        return await prisma.historicoIntegridade.findFirst({
            where: {
                maquinaId: Number(maquinaId),
                criadoEm: {
                    lte: new Date(dataReferencia)
                }
            },
            orderBy: { criadoEm: 'desc' },
            select: {
                id: true,
                maquinaId: true,
                integridade: true,
                scoreEstabilidade: true,
                origem: true,
                observacao: true,
                criadoEm: true
            }
        });
    }

    static async findSerieByMaquina(maquinaId, { limite = 30, dataInicio, dataFim } = {}) {
        const where = {
            maquinaId: Number(maquinaId)
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

        const historico = await prisma.historicoIntegridade.findMany({
            where,
            take: Number(limite),
            orderBy: { criadoEm: 'desc' },
            select: {
                id: true,
                maquinaId: true,
                integridade: true,
                scoreEstabilidade: true,
                origem: true,
                observacao: true,
                criadoEm: true
            }
        });

        return historico.reverse();
    }

    static async findAll({ maquinaId, dataInicio, dataFim, limite = 100 } = {}) {
        const where = {};

        if (maquinaId !== undefined) {
            where.maquinaId = Number(maquinaId);
        }

        if (dataInicio || dataFim) {
            where.criadoEm = {};

            if (dataInicio) {
                where.criadoEm.gte = new Date(dataInicio);
            }

            if (dataFim) {
                where.criadoEm.lte = new Date(dataFim);
            }
        }

        return await prisma.historicoIntegridade.findMany({
            where,
            take: limite,
            orderBy: { criadoEm: 'desc' },
            include: {
                maquina: {
                    select: {
                        id: true,
                        nome: true,
                        setor: true,
                        tipo: true,
                        criticidade: true
                    }
                }
            }
        });
    }

    static async findById(id) {
        return await prisma.historicoIntegridade.findUnique({
            where: { id: Number(id) },
            include: {
                maquina: {
                    select: {
                        id: true,
                        nome: true,
                        setor: true,
                        tipo: true,
                        criticidade: true
                    }
                }
            }
        });
    }
}

module.exports = HistoricoIntegridadeModel;
