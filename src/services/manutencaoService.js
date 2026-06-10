const AlertaModel = require("../models/alertaModel");
const MaquinaModel = require("../models/maquinaModel");
const ManutecaoModel = require("../models/manutencaoModel");
const UsuarioModel = require("../models/usuarioModel");
const AppError = require("../utils/appErrorUtils");
const logger = require("../utils/logger");
const simuladorJob = require("../jobs/simuladorJob");
const { ROLES } = require("../utils/authorization");

class ManutecaoService {
  static STATUS_VALIDOS = ["EM_ANDAMENTO", "RESOLVIDO", "ENCERRADO_SEM_SOLUCAO"];
  static STATUS_CRIACAO = "EM_ANDAMENTO";
  static TIPOS_VALIDOS = ["CORRETIVA", "PREVENTIVA"];

  static async create({ alertaId, maquinaId, usuarioId, tipo, observacao }) {
    const usuarioIdNum = parseInt(usuarioId);
    const tipoNormalizado = String(tipo || (alertaId ? "CORRETIVA" : "PREVENTIVA")).trim().toUpperCase();

    if (Number.isNaN(usuarioIdNum)) {
      throw new AppError("Ids informados sao invalidos!", 400);
    }

    if (!this.TIPOS_VALIDOS.includes(tipoNormalizado)) {
      throw new AppError("Tipo de manutencao invalido!", 400);
    }

    if (!observacao || observacao.trim().length < 3) {
      throw new AppError("Observacao nao e valida!", 400);
    }

    const usuario = await UsuarioModel.findById(usuarioIdNum);
    if (!usuario) {
      throw new AppError("Usuario nao encontrado!", 404);
    }

    if (!usuario.ativo) {
      throw new AppError("Nao e possivel vincular um usuario inativo!", 400);
    }

    if (tipoNormalizado === "PREVENTIVA") {
      if (usuario.role !== ROLES.TECNICO) {
        throw new AppError("Apenas tecnicos podem criar manutencao preventiva!", 403);
      }

      return await this.createPreventiva({
        maquinaId,
        usuarioId: usuarioIdNum,
        observacao: observacao.trim()
      });
    }

    return await this.createCorretiva({
      alertaId,
      usuarioId: usuarioIdNum,
      observacao: observacao.trim()
    });
  }

  static async createCorretiva({ alertaId, usuarioId, observacao }) {
    const alertaIdNum = parseInt(alertaId);

    if (Number.isNaN(alertaIdNum)) {
      throw new AppError("Ids informados sao invalidos!", 400);
    }

    const alerta = await AlertaModel.findById(alertaIdNum);
    if (!alerta) {
      throw new AppError("Alerta nao existe!", 404);
    }

    if (alerta.status === "RESOLVIDO" || alerta.status === "CANCELADO") {
      throw new AppError("Nao e possivel criar uma manutencao para um alerta encerrado!", 400);
    }

    const manutencoesDoAlerta = await ManutecaoModel.findByAlertaId(alertaIdNum);
    const manutencaoEmAndamento = manutencoesDoAlerta.some((manutencao) => manutencao.status === "EM_ANDAMENTO");

    if (manutencaoEmAndamento) {
      throw new AppError("Ja existe uma manutencao em aberto para este alerta!", 400);
    }

    const manutencao = await ManutecaoModel.createWithAlertSync({
      alertaId: alertaIdNum,
      usuarioId,
      observacao,
      status: this.STATUS_CRIACAO
    });

    logger.info("manutencao_created", {
      manutencaoId: manutencao.id,
      alertaId: alertaIdNum,
      maquinaId: alerta.maquinaId,
      usuarioId,
      tipo: "CORRETIVA",
      status: manutencao.status
    });

    return manutencao;
  }

  static async createPreventiva({ maquinaId, usuarioId, observacao }) {
    const maquinaIdNum = parseInt(maquinaId);

    if (Number.isNaN(maquinaIdNum)) {
      throw new AppError("Id da maquina invalido!", 400);
    }

    const maquina = await MaquinaModel.findById(maquinaIdNum);
    if (!maquina) {
      throw new AppError("Maquina nao encontrada!", 404);
    }

    if (!maquina.ativo) {
      throw new AppError("Nao e possivel criar manutencao para uma maquina inativa!", 400);
    }

    const manutencao = await ManutecaoModel.create({
      alertaId: null,
      maquinaId: maquinaIdNum,
      usuarioId,
      tipo: "PREVENTIVA",
      observacao,
      status: this.STATUS_CRIACAO
    });

    logger.info("manutencao_created", {
      manutencaoId: manutencao.id,
      alertaId: null,
      maquinaId: maquinaIdNum,
      usuarioId,
      tipo: "PREVENTIVA",
      status: manutencao.status
    });

    return manutencao;
  }

  static async list({ page, limit, usuario }) {
    const pageNum = parseInt(page) || 1;
    const take = parseInt(limit) || 10;
    const skip = (pageNum - 1) * take;
    const where = usuario?.role === ROLES.TECNICO ? { tipo: "PREVENTIVA" } : {};

    const [dados, total] = await Promise.all([
      ManutecaoModel.findAll({ skip, take, where }),
      ManutecaoModel.count(where)
    ]);

    const totalPages = Math.ceil(total / take);
    return { dados, total, page: pageNum, totalPages };
  }

  static async findByAlertaId(id) {
    const alertaId = parseInt(id);

    if (Number.isNaN(alertaId)) {
      throw new AppError("Id do alerta invalido!", 400);
    }

    const alerta = await AlertaModel.findById(alertaId);
    if (!alerta) {
      throw new AppError("Nao foi possivel encontrar o alerta!", 404);
    }

    return await ManutecaoModel.findByAlertaId(alertaId);
  }

  static async findById(id) {
    const manutencaoId = parseInt(id);

    if (Number.isNaN(manutencaoId)) {
      throw new AppError("Id da manutencao invalido!", 400);
    }

    const manutencao = await ManutecaoModel.findById(manutencaoId);
    if (!manutencao) {
      throw new AppError("Nao foi possivel encontrar a manutencao!", 404);
    }

    return manutencao;
  }

  static async update(id, usuarioId, { dados }) {
    const manutencaoId = parseInt(id);
    const usuarioIdNum = parseInt(usuarioId);

    if (Number.isNaN(manutencaoId) || Number.isNaN(usuarioIdNum)) {
      throw new AppError("Id da manutencao invalido!", 400);
    }

    const manutencao = await ManutecaoModel.findById(manutencaoId);
    if (!manutencao) {
      throw new AppError("Manutencao nao foi encontrada!", 404);
    }

    if (manutencao.status !== "EM_ANDAMENTO") {
      throw new AppError("Manutencao encerrada nao pode mais ser alterada!", 409);
    }

    const usuario = await UsuarioModel.findById(usuarioIdNum);
    if (!usuario) {
      throw new AppError("Usuario nao encontrado!", 404);
    }

    if (usuario.id !== manutencao.usuarioId) {
      throw new AppError("Voce nao tem permissao para alterar a manutencao de outro tecnico!", 403);
    }

    const dadosAtualizados = {};

    if (dados.observacao !== undefined) {
      if (typeof dados.observacao !== "string" || dados.observacao.trim().length < 3) {
        throw new AppError("Observacao nao e valida!", 400);
      }

      dadosAtualizados.observacao = dados.observacao.trim();
    }

    if (dados.status !== undefined) {
      if (!this.STATUS_VALIDOS.includes(dados.status)) {
        throw new AppError("Status nao e valido!", 400);
      }

      dadosAtualizados.status = dados.status;
    }

    if (Object.keys(dadosAtualizados).length === 0) {
      throw new AppError("Nenhum dado valido foi enviado para atualizacao!", 400);
    }

    const manutencaoAtualizada = manutencao.tipo === "PREVENTIVA"
      ? await ManutecaoModel.updatePreventiva({
          manutencaoId,
          dados: dadosAtualizados
        })
      : await ManutecaoModel.updateWithAlertSync({
          manutencaoId,
          alertaId: manutencao.alertaId,
          usuarioId: manutencao.usuarioId,
          dados: dadosAtualizados
        });

    if (dadosAtualizados.status === "RESOLVIDO") {
      const maquinaIdParaReset = manutencao.maquinaId || manutencao.alerta?.maquinaId;
      if (maquinaIdParaReset) {
        simuladorJob.resetarMaquinaSimulada(maquinaIdParaReset);
      }
    }

    logger.info("manutencao_updated", {
      manutencaoId,
      alertaId: manutencao.alertaId,
      maquinaId: manutencao.maquinaId,
      usuarioId: manutencao.usuarioId,
      tipo: manutencao.tipo,
      camposAtualizados: Object.keys(dadosAtualizados),
      status: manutencaoAtualizada.status
    });

    return manutencaoAtualizada;
  }
}

module.exports = ManutecaoService;
