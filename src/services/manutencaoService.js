const AlertaModel = require("../models/alertaModel");
const ManutecaoModel = require("../models/manutencaoModel");
const UsuarioModel = require("../models/usuarioModel");
const AppError = require("../utils/appErrorUtils");

class ManutecaoService {
    static STATUS_VALIDOS = ["EM_ANDAMENTO", "RESOLVIDO", "ENCERRADO_SEM_SOLUCAO"];
    static STATUS_CRIACAO = "EM_ANDAMENTO";

    static async create({ alertaId, usuarioId, observacao }) {
        const alertaIdNum = parseInt(alertaId);
        const usuarioIdNum = parseInt(usuarioId);

        if (Number.isNaN(alertaIdNum) || Number.isNaN(usuarioIdNum)) {
            throw new AppError("Ids informados sao invalidos!", 400);
        };

        if (!observacao || observacao.trim().length < 3) {
            throw new AppError("Observacao não é valida!", 400);
        };


        const alerta = await AlertaModel.findById(alertaIdNum);

        if (!alerta) {
            throw new AppError("Alerta não existe!", 404);
        };

        if (alerta.status === "RESOLVIDO" || alerta.status === "CANCELADO") {
            throw new AppError("Não é possivel criar uma manutencao para um alerta encerrado!", 400);
        };

        const manutencoesDoAlerta = await ManutecaoModel.findByAlertaId(alertaIdNum);
        const manutencaoEmAndamento = manutencoesDoAlerta.some((m) => m.status === "EM_ANDAMENTO");

        if (manutencaoEmAndamento) {
            throw new AppError("Ja existe uma manutencao em aberto para este alerta!", 400);
        };

        const usuario = await UsuarioModel.findById(usuarioIdNum);

        if (!usuario) {
            throw new AppError("Usuario não encontrado!", 404);
        };

        if (!usuario.ativo) {
            throw new AppError("Não é possivel vincular um usuario inativo!", 400);
        };

        return await ManutecaoModel.createWithAlertSync({
            alertaId: alertaIdNum,
            usuarioId: usuarioIdNum,
            observacao: observacao.trim(),
            status: this.STATUS_CRIACAO
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

        const alerta = await AlertaModel.findById(alertaId);

        if (!alerta) {
            throw new AppError("Não foi possivel encontrar o alerta!", 404);
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
            throw new AppError("Não foi possivel encontrar a manutencao!", 404);
        };

        return manutencao;
    };

    static async update(id, usuarioId, { dados }) {
        const manutencaoId = parseInt(id);
        const usuarioIdNum = parseInt(usuarioId);

        if (Number.isNaN(manutencaoId) || Number.isNaN(usuarioIdNum)) {
            throw new AppError("Id da manutencao invalido!", 400);
        };

        const manutencao = await ManutecaoModel.findById(manutencaoId);

        if (!manutencao) {
            throw new AppError("Manutencao não foi encontrada!", 404);
        };

        if (manutencao.status !== "EM_ANDAMENTO") {
            throw new AppError("Manutencao encerrada nao pode mais ser alterada!", 409);
        };

        const usuario = await UsuarioModel.findById(usuarioIdNum);

        if (!usuario) {
            throw new AppError("Usuario não encontrado!", 404);
        };

        if (usuario.id !== manutencao.usuarioId) {
            throw new AppError("Voce não tem permissao para alterar a manutencao de outro tecnico!", 403);
        };

        const dadosAtualizados = {};

        if (dados.observacao !== undefined) {
            if (typeof dados.observacao !== "string" || dados.observacao.trim().length < 3) {
                throw new AppError("Observacao não é valida!", 400);
            };

            dadosAtualizados.observacao = dados.observacao.trim();
        };

        if (dados.status !== undefined) {
            if (!this.STATUS_VALIDOS.includes(dados.status)) {
                throw new AppError("Status não é valido!", 400);
            };

            dadosAtualizados.status = dados.status;
        };

        if (Object.keys(dadosAtualizados).length === 0) {
            throw new AppError("Nenhum dado valido foi enviado para atualizacao!", 400);
        };

        return await ManutecaoModel.updateWithAlertSync({
            manutencaoId,
            alertaId: manutencao.alertaId,
            usuarioId: manutencao.usuarioId,
            dados: dadosAtualizados
        });
    };
}

module.exports = ManutecaoService;