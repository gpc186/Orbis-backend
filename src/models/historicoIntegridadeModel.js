const { Prisma } = require("@prisma/client");
const prisma = require('../prisma/prisma');

class HistoricoIntegridadeModel {
    static ORIGENS_REPARO = ["MANUTENCAO_RESOLVIDA", "MANUTENCAO_PREVENTIVA_RESOLVIDA"];

    static aplicarDataMinima(where, dataMinima) {
        if (!dataMinima) return;

        where.criadoEm = where.criadoEm || {};
        const atual = where.criadoEm.gte ? new Date(where.criadoEm.gte) : null;
        const candidata = new Date(dataMinima);

        if (Number.isNaN(candidata.getTime())) return;

        if (!atual || Number.isNaN(atual.getTime()) || candidata > atual) {
            where.criadoEm.gte = candidata;
        }
    }

    static async findLatestRepairByMaquina(maquinaId) {
        return await prisma.historicoIntegridade.findFirst({
            where: {
                maquinaId: Number(maquinaId),
                origem: { in: this.ORIGENS_REPARO }
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

    static async findSerieByMaquina(maquinaId, { limite = 30, dataInicio, dataFim, aposUltimaManutencao = false } = {}) {
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

        if (aposUltimaManutencao) {
            const ultimoReparo = await this.findLatestRepairByMaquina(maquinaId);
            this.aplicarDataMinima(where, ultimoReparo?.criadoEm);
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

    static async findAll({ maquinaId, dataInicio, dataFim, limite = 100, aposUltimaManutencao = false } = {}) {
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

        if (aposUltimaManutencao && maquinaId !== undefined) {
            const ultimoReparo = await this.findLatestRepairByMaquina(maquinaId);
            this.aplicarDataMinima(where, ultimoReparo?.criadoEm);
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

    static async findAggregatedByMaquina(maquinaId, { dataInicio, dataFim, bucketMinutes }) {
        const bucketSeconds = Number(bucketMinutes) * 60;

        return await prisma.$queryRaw`
            SELECT
                "maquinaId",
                AVG("integridade")::float AS "integridade",
                AVG("scoreEstabilidade")::float AS "scoreEstabilidade",
                to_timestamp("bucketEpoch") AS "criadoEm",
                ${Prisma.raw(`'AGREGADO_${bucketMinutes}M'`)} AS "origem"
            FROM (
                SELECT
                    "maquinaId",
                    "integridade",
                    "scoreEstabilidade",
                    floor(extract(epoch from "criadoEm") / ${bucketSeconds}) * ${bucketSeconds} AS "bucketEpoch"
                FROM "HistoricoIntegridade"
                WHERE "maquinaId" = ${Number(maquinaId)}
                  AND "criadoEm" >= ${dataInicio}
                  AND "criadoEm" <= ${dataFim}
            ) AS buckets
            GROUP BY "maquinaId", "bucketEpoch"
            HAVING to_timestamp("bucketEpoch") >= ${dataInicio}
               AND to_timestamp("bucketEpoch") <= ${dataFim}
            ORDER BY "criadoEm" ASC
        `;
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
