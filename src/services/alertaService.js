const AlertaModel = require("../models/alertaModel");
const MaquinaModel = require("../models/maquinaModel");
const UsuarioModel = require("../models/usuarioModel");
const AppError = require("../utils/appErrorUtils");
const OneSignalService = require("./oneSignalService");
const logger = require("../utils/logger");

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
      return;
    }

    const maquina = await MaquinaModel.findById(alerta.maquinaId);
    if (!maquina) {
      return;
    }

    const destinatarios = await this.buscarDestinatariosDoAlerta();
    const oneSignalIds = [...new Set(destinatarios.map((usuario) => usuario.oneSignalId).filter(Boolean))];

    if (oneSignalIds.length === 0) {
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
      throw new AppError("Erro ao contar maquinas com alerta.", 500);
    }
  }

  static async countActiveAlertas() {
    try {
      return await AlertaModel.countActiveAlertas();
    } catch (error) {
      throw new AppError("Erro ao contar alertas ativos.", 500);
    }
  }

  static async countAlertasToday() {
    try {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      return await AlertaModel.countAlertasToday(hoje);
    } catch (error) {
      throw new AppError("Erro ao contar alertas de hoje.", 500);
    }
  }

  static async countAlertaSemAtendimento() {
    try {
      return await AlertaModel.countAlertaSemAtendimento();
    } catch (error) {
      throw new AppError("Erro ao contar alertas sem atendimento.", 500);
    }
  }

  static async countAtendedToday() {
    try {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      return await AlertaModel.countAtendedToday(hoje);
    } catch (error) {
      throw new AppError("Erro ao contar alertas atendidos hoje.", 500);
    }
  }

  static async findAll() {
    return await AlertaModel.findAll();
  }

  static async findById(id) {
    try {
      const alerta = await AlertaModel.findById(id);
      if (!alerta) {
        throw new AppError("Alerta nao encontrada.", 404);
      }

      return alerta;
    } catch (error) {
      throw new AppError("Erro ao buscar alerta.", 500);
    }
  }
}

module.exports = AlertaService;
