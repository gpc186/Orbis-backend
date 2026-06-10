const prisma = require("../prisma/prisma");

class ManutecaoModel {
    static INTEGRIDADE_REPARADA = 100;
    static SCORE_ESTABILIDADE_REPARADO = 100;

    static includeRelations = {
        alerta: true,
        maquina: {
            select: {
                id: true,
                nome: true,
                setor: true,
                tipo: true,
                criticidade: true,
                ativo: true,
                integridade: true,
                scoreEstabilidade: true
            }
        },
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
    };

    static async create({
        alertaId,
        maquinaId,
        usuarioId,
        tipo,
        titulo,
        prioridade,
        origem,
        observacao,
        status,
        dataAgendada,
        janelaAgendadaInicio,
        janelaAgendadaFim,
        concluidaEm,
        cumprimentoAgendamento,
        metadataPredicao
    }) {
        return await prisma.manutencao.create({
            data: {
                alertaId,
                maquinaId,
                usuarioId,
                tipo,
                titulo,
                prioridade,
                origem,
                observacao,
                status,
                dataAgendada,
                janelaAgendadaInicio,
                janelaAgendadaFim,
                concluidaEm,
                cumprimentoAgendamento,
                metadataPredicao
            },
            include: this.includeRelations
        });
    };

    static async findAll({ skip, take, where = {} }) {
        return await prisma.manutencao.findMany({
            where,
            skip,
            take,
            include: this.includeRelations,
            orderBy: { criadoEm: "desc" }
        });
    };

    static async findByAlertaId(alertaId) {
        return await prisma.manutencao.findMany({
            where: { alertaId: parseInt(alertaId) },
            include: this.includeRelations,
            orderBy: { criadoEm: "desc" }
        });
    };

    static async findById(id) {
        return await prisma.manutencao.findUnique({
            where: { id: parseInt(id) },
            include: this.includeRelations
        });
    };

    static async findOpenPredictiveByMaquinaId(maquinaId) {
        return await prisma.manutencao.findFirst({
            where: {
                maquinaId: parseInt(maquinaId),
                tipo: "PREVENTIVA",
                origem: "PREDICAO",
                status: { in: ["AGENDADA", "EM_ANDAMENTO"] }
            },
            include: this.includeRelations,
            orderBy: { criadoEm: "desc" }
        });
    };

    static async update({ id, dados }) {
        return await prisma.manutencao.update({
            where: { id: parseInt(id) },
            data: dados,
            include: this.includeRelations
        });
    };

    static async createWithAlertSync({
        alertaId,
        usuarioId,
        titulo,
        prioridade,
        origem,
        observacao,
        status,
        concluidaEm,
        cumprimentoAgendamento
    }) {
        return await prisma.$transaction(async (tx) => {
            const alerta = await tx.alerta.findUnique({
                where: { id: alertaId }
            });

            const manutencao = await tx.manutencao.create({
                data: {
                    alertaId,
                    maquinaId: alerta.maquinaId,
                    usuarioId,
                    tipo: "CORRETIVA",
                    titulo,
                    prioridade,
                    origem,
                    observacao,
                    status,
                    concluidaEm,
                    cumprimentoAgendamento
                },
                include: this.includeRelations
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

    static async repairMaquina(tx, maquinaId, { origem, observacao, referenciaTemporal = new Date() }) {
        const maquinaReparada = await tx.maquina.update({
            where: { id: parseInt(maquinaId) },
            data: {
                integridade: this.INTEGRIDADE_REPARADA,
                scoreEstabilidade: this.SCORE_ESTABILIDADE_REPARADO,
                previsaoManutencao: null,
                janelaManuInicio: null,
                janelaManuFim: null
            }
        });

        const sensores = await tx.sensor.findMany({
            where: { maquinaId: maquinaReparada.id },
            select: {
                id: true,
                idealTemperatura: true,
                idealVibracao: true
            }
        });

        await Promise.all(sensores.map((sensor) => tx.sensor.update({
            where: { id: sensor.id },
            data: {
                ultimaTemperatura: sensor.idealTemperatura,
                ultimaVibracao: sensor.idealVibracao,
                ultimaLeituraEm: referenciaTemporal
            }
        })));

        await tx.historicoIntegridade.create({
            data: {
                maquinaId: maquinaReparada.id,
                integridade: maquinaReparada.integridade,
                scoreEstabilidade: maquinaReparada.scoreEstabilidade,
                origem,
                observacao
            }
        });
    }

    static async updateWithAlertSync({ manutencaoId, alertaId, usuarioId, dados }) {
        return await prisma.$transaction(async (tx) => {
            const alerta = await tx.alerta.findUnique({
                where: { id: parseInt(alertaId) }
            });

            const manutencaoAtualizada = await tx.manutencao.update({
                where: { id: parseInt(manutencaoId) },
                data: dados,
                include: this.includeRelations
            });

            let tipoEvento = "ATUALIZADO";
            let statusNovo = alerta?.status;
            let descricao = dados.observacao ?? "Manutencao atualizada";

            if (dados.status) {
                const dadosAlerta = {};

                if (dados.status === "RESOLVIDO") {
                    const encerradoEm = new Date();
                    dadosAlerta.status = "RESOLVIDO";
                    dadosAlerta.tecnicoId = usuarioId;
                    dadosAlerta.encerradoEm = encerradoEm;
                    tipoEvento = "RESOLVIDO";
                    statusNovo = "RESOLVIDO";
                    descricao = dados.observacao ?? "Alerta resolvido";

                    if (alerta?.maquinaId) {
                        await this.repairMaquina(tx, alerta.maquinaId, {
                            origem: "MANUTENCAO_RESOLVIDA",
                            observacao: descricao,
                            referenciaTemporal: encerradoEm
                        });
                    }
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

    static async updatePreventiva({ manutencaoId, dados }) {
        return await prisma.$transaction(async (tx) => {
            const manutencaoAtualizada = await tx.manutencao.update({
                where: { id: parseInt(manutencaoId) },
                data: dados,
                include: this.includeRelations
            });

            if (dados.status === "RESOLVIDO") {
                await this.repairMaquina(tx, manutencaoAtualizada.maquinaId, {
                    origem: "MANUTENCAO_PREVENTIVA_RESOLVIDA",
                    observacao: dados.observacao ?? "Manutencao preventiva resolvida",
                    referenciaTemporal: dados.concluidaEm || new Date()
                });
            }

            return manutencaoAtualizada;
        });
    };

    static async count(where = {}){
        return prisma.manutencao.count({ where })
    }
}

module.exports = ManutecaoModel;
