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
            const alerta = await tx.alerta.findUnique({
                where: { id: alertaId }
            });

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
                    status: "EM_ANDAMENTO",
                    encerradoEm: null
                }
            });

            await tx.alertaEvento.create({
                data: {
                    alertaId,
                    usuarioId,
                    manutencaoId: manutencao.id,
                    tipo: "ACEITO",
                    statusAnterior: alerta?.status,
                    statusNovo: "EM_ANDAMENTO",
                    mensagem: alerta?.mensagem,
                    descricao: observacao
                }
            });

            return manutencao;
        });
    };

    static async updateWithAlertSync({ manutencaoId, alertaId, usuarioId, dados }) {
        return await prisma.$transaction(async (tx) => {
            const alerta = await tx.alerta.findUnique({
                where: { id: parseInt(alertaId) }
            });

            const manutencaoAtualizada = await tx.manutencao.update({
                where: { id: parseInt(manutencaoId) },
                data: dados
            });

            let tipoEvento = "ATUALIZADO";
            let statusNovo = alerta?.status;
            let descricao = dados.observacao ?? "Manutencao atualizada";

            if (dados.status) {
                const dadosAlerta = {};

                if (dados.status === "RESOLVIDO") {
                    dadosAlerta.status = "RESOLVIDO";
                    dadosAlerta.tecnicoId = usuarioId;
                    dadosAlerta.encerradoEm = new Date();
                    tipoEvento = "RESOLVIDO";
                    statusNovo = "RESOLVIDO";
                    descricao = dados.observacao ?? "Alerta resolvido";
                } else if (dados.status === "ENCERRADO_SEM_SOLUCAO") {
                    dadosAlerta.status = "ATIVO";
                    dadosAlerta.tecnicoId = null;
                    dadosAlerta.encerradoEm = null;
                    tipoEvento = "REABERTO";
                    statusNovo = "ATIVO";
                    descricao = dados.observacao ?? "Manutencao encerrada sem solucao";
                } else {
                    dadosAlerta.status = "EM_ANDAMENTO";
                    dadosAlerta.tecnicoId = usuarioId;
                    dadosAlerta.encerradoEm = null;
                    statusNovo = "EM_ANDAMENTO";
                    descricao = dados.observacao ?? "Manutencao em andamento";
                }

                await tx.alerta.update({
                    where: { id: parseInt(alertaId) },
                    data: dadosAlerta
                });
            }

            await tx.alertaEvento.create({
                data: {
                    alertaId: parseInt(alertaId),
                    usuarioId,
                    manutencaoId: parseInt(manutencaoId),
                    tipo: tipoEvento,
                    statusAnterior: alerta?.status,
                    statusNovo,
                    mensagem: alerta?.mensagem,
                    descricao
                }
            });

            return manutencaoAtualizada;
        });
    };

    static async count(){
        return prisma.manutencao.count()
    }
}

module.exports = ManutecaoModel;
