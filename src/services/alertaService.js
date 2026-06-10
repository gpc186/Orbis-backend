const AlertaModel = require("../models/alertaModel");
const MaquinaModel = require("../models/maquinaModel");
const UsuarioModel = require("../models/usuarioModel");
const AppError = require("../utils/appErrorUtils");
const OneSignalService = require("./oneSignalService");
const logger = require("../utils/logger");
const {
  ROLES,
  assertRole
} = require("../utils/authorization");
const {
  attachSla,
  attachSlaToMany,
  summarizeOpenSla
} = require("./alertaSlaService");

const COMENTARIO_MAX_LENGTH = 1000;

class AlertaService {
  static async gerarAlerta(sensorId, maquinaId, tipo, mensagem) {
    const alertaExistente = await AlertaModel.findAtivo(sensorId, tipo);

    if (alertaExistente) {
      const alertaAtualizado = await AlertaModel.update(alertaExistente.id, {
        mensagem: `${mensagem} (Ocorrencia repetida em ${new Date().toLocaleDateString()})`,
        eventos: {
          create: {
            tipo: "ATUALIZADO",
            statusAnterior: alertaExistente.status,
            statusNovo: alertaExistente.status,
            mensagem,
            descricao: "Limite ultrapassado novamente"
          }
        }
      });

      logger.info("alerta_updated", {
        alertaId: alertaAtualizado.id,
        sensorId,
        maquinaId,
        tipo
      });

      return alertaAtualizado;
    }

    const novoAlerta = await AlertaModel.create(sensorId, maquinaId, tipo, mensagem);

    logger.info("alerta_created", {
      alertaId: novoAlerta.id,
      sensorId,
      maquinaId,
      tipo
    });

    try {
      await this.notificarNovoAlerta(novoAlerta.id);
    } catch (error) {
      logger.error("alerta_push_notification_failed", {
        alertaId: novoAlerta.id,
        sensorId,
        maquinaId,
        tipo,
        error
      });
    }

    return novoAlerta;
  }

  static async notificarNovoAlerta(alertaId) {
    const alerta = await AlertaModel.findById(alertaId);
    if (!alerta) {
      logger.warn("alerta_notification_skipped", {
        alertaId,
        reason: "alerta_not_found"
      });
      return;
    }

    const maquina = await MaquinaModel.findById(alerta.maquinaId);
    if (!maquina) {
      logger.warn("alerta_notification_skipped", {
        alertaId,
        maquinaId: alerta.maquinaId,
        reason: "maquina_not_found"
      });
      return;
    }

    const destinatarios = await this.buscarDestinatariosDoAlerta();
    const oneSignalIds = [...new Set(destinatarios.map((usuario) => usuario.oneSignalId).filter(Boolean))];

    if (oneSignalIds.length === 0) {
      logger.info("alerta_notification_skipped", {
        alertaId,
        maquinaId: alerta.maquinaId,
        reason: "no_recipients"
      });
      return;
    }

    await OneSignalService.sendToOneSignalIds({
      oneSignalIds,
      title: "Novo alerta",
      message: `${maquina.nome} gerou um alerta de ${alerta.tipo}.`,
      data: {
        tipo: "novo_alerta",
        alertaId: alerta.id,
        maquinaId: alerta.maquinaId,
        sensorId: alerta.sensorId
      }
    });
  }

  static async buscarDestinatariosDoAlerta() {
    const usuarios = await UsuarioModel.findNotificationRecipients();
    return usuarios.filter((usuario) => usuario.ativo && usuario.oneSignalId);
  }

  static async countMaquinasWithAlerta() {
    try {
      return await AlertaModel.countMaquinasWithAlerta();
    } catch (error) {
      logger.error("alerta_count_maquinas_error", { error });
      throw new AppError("Erro ao contar maquinas com alerta.", 500);
    }
  }

  static async countActiveAlertas() {
    try {
      return await AlertaModel.countActiveAlertas();
    } catch (error) {
      logger.error("alerta_count_active_error", { error });
      throw new AppError("Erro ao contar alertas ativos.", 500);
    }
  }

  static async countAlertasToday() {
    try {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      return await AlertaModel.countAlertasToday(hoje);
    } catch (error) {
      logger.error("alerta_count_today_error", { error });
      throw new AppError("Erro ao contar alertas de hoje.", 500);
    }
  }

  static async countAlertaSemAtendimento() {
    try {
      return await AlertaModel.countAlertaSemAtendimento();
    } catch (error) {
      logger.error("alerta_count_sem_atendimento_error", { error });
      throw new AppError("Erro ao contar alertas sem atendimento.", 500);
    }
  }

  static async countAtendedToday() {
    try {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      return await AlertaModel.countAtendedToday(hoje);
    } catch (error) {
      logger.error("alerta_count_atendidos_hoje_error", { error });
      throw new AppError("Erro ao contar alertas atendidos hoje.", 500);
    }
  }

  static async findAll() {
    const alertas = await AlertaModel.findAll();
    return attachSlaToMany(alertas, { stripSources: true });
  }

  static async findAllEventos() {
    try {
      return await AlertaModel.findAllEventos();
    } catch (error) {
      logger.error("alerta_find_all_eventos_error", { error });
      throw new AppError("Erro ao buscar eventos de alerta.", 500);
    }
  }

  static async findEventosByAlertaId(id) {
    try {
      const alerta = await AlertaModel.findById(id);
      if (!alerta) {
        throw new AppError("Alerta nao encontrada.", 404);
      }

      return await AlertaModel.findEventosByAlertaId(id);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      logger.error("alerta_find_eventos_by_id_error", {
        alertaId: id,
        error
      });
      throw new AppError("Erro ao buscar eventos do alerta.", 500);
    }
  }

  static async findById(id) {
    try {
      const alerta = await AlertaModel.findById(id);
      if (!alerta) {
        throw new AppError("Alerta nao encontrada.", 404);
      }

      return attachSla(alerta);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      logger.error("alerta_find_by_id_error", {
        alertaId: id,
        error
      });
      throw new AppError("Erro ao buscar alerta.", 500);
    }
  }

  static async createComentario({ alertaId, usuario, mensagem }) {
    assertRole({
      usuario,
      roles: [ROLES.ADMIN, ROLES.TECNICO],
      message: "Credenciais invalidas!"
    });

    const mensagemNormalizada = typeof mensagem === "string" ? mensagem.trim() : "";

    if (!mensagemNormalizada) {
      throw new AppError("Mensagem do comentario e obrigatoria.", 400);
    }

    if (mensagemNormalizada.length > COMENTARIO_MAX_LENGTH) {
      throw new AppError(`Mensagem do comentario deve ter no maximo ${COMENTARIO_MAX_LENGTH} caracteres.`, 400);
    }

    try {
      const alerta = await AlertaModel.findById(alertaId);
      if (!alerta) {
        throw new AppError("Alerta nao encontrada.", 404);
      }

      return await AlertaModel.createComentario({
        alertaId,
        usuarioId: usuario.id,
        mensagem: mensagemNormalizada
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      logger.error("alerta_create_comentario_error", {
        alertaId,
        usuarioId: usuario?.id,
        error
      });
      throw new AppError("Erro ao criar comentario do alerta.", 500);
    }
  }

  static async findAtivos({ limit = 10 }) {
    const safeLimit = Math.min(Math.max(Number(limit || 10), 1), 20);

    try {
      const dados = await AlertaModel.findAtivos({ limit: safeLimit });
      return {
        total: dados.length,
        dados: attachSlaToMany(dados, { stripSources: true })
      };
    } catch (error) {
      logger.error("alerta_find_active_error", { limit: safeLimit, error });
      throw new AppError("Erro ao buscar alertas ativos.", 500);
    }
  }

  static async findByMaquinaId(maquinaId, { limit = 10, somenteAtivos } = {}) {
    const maquinaIdNum = parseInt(maquinaId);

    if (Number.isNaN(maquinaIdNum)) {
      throw new AppError("Id da maquina invalido!", 400);
    }

    const safeLimit = Math.min(Math.max(Number(limit || 10), 1), 20);

    try {
      const maquina = await MaquinaModel.findById(maquinaIdNum);
      if (!maquina) {
        throw new AppError("Maquina nao encontrada.", 404);
      }

      const dados = await AlertaModel.findByMaquinaId(maquinaIdNum, {
        skip: 0,
        take: safeLimit,
        status: somenteAtivos ? "ATIVO" : undefined
      });

      return {
        total: dados.length,
        dados: attachSlaToMany(dados, { stripSources: true })
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      logger.error("alerta_find_by_maquina_error", {
        maquinaId: maquinaIdNum,
        limit: safeLimit,
        somenteAtivos,
        error
      });
      throw new AppError("Erro ao buscar alertas da maquina.", 500);
    }
  }

  static async getSlaSummary() {
    try {
      const alertas = await AlertaModel.findOpenForSla();
      return summarizeOpenSla(alertas);
    } catch (error) {
      logger.error("alerta_sla_summary_error", { error });
      throw new AppError("Erro ao calcular SLA dos alertas.", 500);
    }
  }
}

module.exports = AlertaService;
