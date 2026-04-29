const ManutecaoModel = require("../models/manutencaoModel");
const UsuarioModel = require("../models/usuarioModel");
const prisma = require("../prisma/prisma");
const AppError = require("../utils/appErrorUtils");

class ManutecaoService {
    static STATUS_VALIDOS = ["EM_ANDAMENTO", "RESOLVIDO"];

    static async create({ alertaId, usuarioId, observacao, status }) {
        const alertaIdNum = parseInt(alertaId);
        const usuarioIdNum = parseInt(usuarioId);

        if (Number.isNaN(alertaIdNum) || Number.isNaN(usuarioIdNum)) {
            throw new AppError("Ids informados sao invalidos!", 400);
        };

        if (!observacao || observacao.trim().length < 3) {
            throw new AppError("Observacao nao e valida!", 400);
        };

        if (!this.STATUS_VALIDOS.includes(status)) {
            throw new AppError("Status nao e valido!", 400);
        };

        const alerta = await prisma.alerta.findUnique({
            where: { id: alertaIdNum }
        });

        if (!alerta) {
            throw new AppError("Alerta nao existe!", 404);
        };

        if (alerta.status === "RESOLVIDO" || alerta.status === "CANCELADO") {
            throw new AppError("Nao e possivel criar uma manutencao para um alerta encerrado!", 400);
        };

        const usuario = await UsuarioModel.findById(usuarioIdNum);

        if (!usuario) {
            throw new AppError("Usuario nao encontrado!", 404);
        };

        if (!usuario.ativo) {
            throw new AppError("Nao e possivel vincular um usuario inativo!", 400);
        };

        return await prisma.$transaction(async (tx) => {
            const manutencao = await tx.manutencao.create({
                data: {
                    alertaId: alertaIdNum,
                    usuarioId: usuarioIdNum,
                    observacao: observacao.trim(),
                    status
                }
            });

            await tx.alerta.update({
                where: { id: alertaIdNum },
                data: {
                    tecnicoId: usuarioIdNum,
                    status: status === "RESOLVIDO" ? "RESOLVIDO" : "EM_ANDAMENTO"
                }
            });

            return manutencao;
        });
    };

    static async list({ page, limit }) {
        const pageNum = parseInt(page) || 1;
        const take = parseInt(limit) || 10;
        const skip = (pageNum - 1) * take;

        const [dados, total] = await Promise.all([
            ManutecaoModel.findAll({ skip, take }),
            ManutecaoModel.count()
        ]);

        const totalPages = Math.ceil(total / take);

        return { dados, total, page: pageNum, totalPages };
    };

    static async findByAlertaId(id) {
        const alertaId = parseInt(id);

        if (Number.isNaN(alertaId)) {
            throw new AppError("Id do alerta invalido!", 400);
        };

        const alerta = await prisma.alerta.findUnique({
            where: { id: alertaId }
        });

        if (!alerta) {
            throw new AppError("Nao foi possivel encontrar o alerta!", 404);
        };

        return await ManutecaoModel.findByAlertaId(alertaId);
    };

    static async findById(id) {
        const manutencaoId = parseInt(id);

        if (Number.isNaN(manutencaoId)) {
            throw new AppError("Id da manutencao invalido!", 400);
        };

        const manutencao = await ManutecaoModel.findById(manutencaoId);

        if (!manutencao) {
            throw new AppError("Nao foi possivel encontrar a manutencao!", 404);
        };

        return manutencao;
    };

    static async update(id, { dados }) {
        const manutencaoId = parseInt(id);

        if (Number.isNaN(manutencaoId)) {
            throw new AppError("Id da manutencao invalido!", 400);
        };

        const manutencao = await ManutecaoModel.findById(manutencaoId);

        if (!manutencao) {
            throw new AppError("Manutencao nao foi encontrada!", 404);
        };

        if (manutencao.status === "RESOLVIDO") {
            throw new AppError("Manutencao ja foi resolvida, nao e possivel alterar!", 409);
        };

        const dadosAtualizados = {};

        if (dados.observacao !== undefined) {
            if (typeof dados.observacao !== "string" || dados.observacao.trim().length < 3) {
                throw new AppError("Observacao nao e valida!", 400);
            };

            dadosAtualizados.observacao = dados.observacao.trim();
        };

        if (dados.status !== undefined) {
            if (!this.STATUS_VALIDOS.includes(dados.status)) {
                throw new AppError("Status nao e valido!", 400);
            };

            dadosAtualizados.status = dados.status;
        };

        if (Object.keys(dadosAtualizados).length === 0) {
            throw new AppError("Nenhum dado valido foi enviado para atualizacao!", 400);
        };

        return await prisma.$transaction(async (tx) => {
            const manutencaoAtualizada = await tx.manutencao.update({
                where: { id: manutencaoId },
                data: dadosAtualizados
            });

            if (dadosAtualizados.status) {
                await tx.alerta.update({
                    where: { id: manutencao.alertaId },
                    data: {
                        tecnicoId: manutencao.usuarioId,
                        status: dadosAtualizados.status === "RESOLVIDO" ? "RESOLVIDO" : "EM_ANDAMENTO"
                    }
                });
            };

            return manutencaoAtualizada;
        });
    };
}

module.exports = ManutecaoService;
