const prisma = require("../prisma/prisma");

class ManutecaoModel {
    static async create({ alertaId, usuarioId, observacao, status }) {
        return await prisma.manutencao.create({
            data: {
                alertaId,
                usuarioId,
                observacao,
                status
            }
        });
    };

    static async findAll({ skip, take }) {
        return await prisma.manutencao.findMany({
            skip,
            take,
            include: {
                alerta: true,
                usuario: {
                    select: {
                        id: true,
                        nome: true,
                        email: true,
                        role: true,
                        telefone: true,
                        especialidade: true
                    }
                }
            }
        });
    };

    static async findByAlertaId(alertaId) {
        return await prisma.manutencao.findMany({
            where: { alertaId: parseInt(alertaId) },
            include: {
                usuario: {
                    select: {
                        id: true,
                        nome: true,
                        email: true,
                        role: true,
                        telefone: true,
                        especialidade: true
                    }
                }
            },
            orderBy: { criadoEm: "desc" }
        });
    };

    static async findById(id) {
        return await prisma.manutencao.findUnique({
            where: { id: parseInt(id) },
            include: {
                alerta: true,
                usuario: {
                    select: {
                        id: true,
                        nome: true,
                        email: true,
                        role: true,
                        telefone: true,
                        especialidade: true
                    }
                }
            }
        });
    };

    static async update({ id, dados }) {
        return await prisma.manutencao.update({
            where: { id: parseInt(id) },
            data: dados
        });
    };

    static async createWithAlertSync({ alertaId, usuarioId, observacao, status }) {
        return await prisma.$transaction(async (tx) => {
            const manutencao = await tx.manutencao.create({
                data: {
                    alertaId,
                    usuarioId,
                    observacao,
                    status
                }
            });

            await tx.alerta.update({
                where: { id: alertaId },
                data: {
                    tecnicoId: usuarioId,
                    status: "EM_ANDAMENTO"
                }
            });

            return manutencao;
        });
    };

    static async updateWithAlertSync({ manutencaoId, alertaId, usuarioId, dados }) {
        return await prisma.$transaction(async (tx) => {
            const manutencaoAtualizada = await tx.manutencao.update({
                where: { id: parseInt(manutencaoId) },
                data: dados
            });

            if (dados.status) {
                const dadosAlerta = {};

                if (dados.status === "RESOLVIDO") {
                    dadosAlerta.status = "RESOLVIDO";
                    dadosAlerta.tecnicoId = usuarioId;
                } else if (dados.status === "ENCERRADO_SEM_SOLUCAO") {
                    dadosAlerta.status = "ATIVO";
                    dadosAlerta.tecnicoId = null;
                } else {
                    dadosAlerta.status = "EM_ANDAMENTO";
                    dadosAlerta.tecnicoId = usuarioId;
                }

                await tx.alerta.update({
                    where: { id: parseInt(alertaId) },
                    data: dadosAlerta
                });
            }

            return manutencaoAtualizada;
        });
    };

    static async count(){
        return prisma.manutencao.count()
    }
}

module.exports = ManutecaoModel;