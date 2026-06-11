const AlertaModel = require("../models/alertaModel");
const MaquinaModel = require("../models/maquinaModel");
const ManutecaoModel = require("../models/manutencaoModel");
const UsuarioModel = require("../models/usuarioModel");
const AppError = require("../utils/appErrorUtils");
const logger = require("../utils/logger");
const simuladorJob = require("../jobs/simuladorJob");
const { ROLES } = require("../utils/authorization");
const {
  PRIORIDADES_MANUTENCAO,
  CUMPRIMENTO_AGENDAMENTO,
  parseDate,
  normalizeTitle,
  normalizePriority,
  buildMaintenanceTitle,
  calculateScheduleCompliance,
  enrichMaintenanceSchedule
} = require("../utils/manutencaoScheduleUtils");

class ManutecaoService {
  static STATUS_VALIDOS = ["AGENDADA", "EM_ANDAMENTO", "RESOLVIDO", "ENCERRADO_SEM_SOLUCAO", "CANCELADA"];
  static STATUS_FINAIS = ["RESOLVIDO", "ENCERRADO_SEM_SOLUCAO", "CANCELADA"];
  static STATUS_CRIACAO = "EM_ANDAMENTO";
  static TIPOS_VALIDOS = ["CORRETIVA", "PREVENTIVA"];

  static enrich(item) {
    if (Array.isArray(item)) return item.map((row) => this.enrich(row));
    return enrichMaintenanceSchedule(item);
  }

  static validateObservacao(observacao) {
    if (!observacao || typeof observacao !== "string" || observacao.trim().length < 3) {
      throw new AppError("Observacao nao e valida!", 400);
    }

    return observacao.trim();
  }

  static validateTitulo(titulo, fallback) {
    const normalized = normalizeTitle(titulo, fallback);
    if (!normalized) {
      throw new AppError("Titulo da manutencao nao e valido!", 400);
    }

    return normalized;
  }

  static validatePrioridade(prioridade) {
    const normalized = normalizePriority(prioridade);
    if (!normalized) {
      throw new AppError("Prioridade de manutencao invalida!", 400);
    }

    return normalized;
  }

  static validateFutureDate(value) {
    const date = parseDate(value);
    if (!date) {
      throw new AppError("Data agendada nao e valida!", 400);
    }

    if (date.getTime() <= Date.now()) {
      throw new AppError("Data agendada deve ser futura!", 400);
    }

    return date;
  }

  static buildConcludedFields({ dataAgendada, concluidaEm = new Date(), status }) {
    const compliance = calculateScheduleCompliance({
      dataAgendada,
      concluidaEm,
      status
    });

    return {
      concluidaEm,
      cumprimentoAgendamento: compliance.cumprimentoAgendamento
    };
  }

  static mapPredicaoPrioridade(urgencia) {
    const normalized = String(urgencia || "").trim().toUpperCase();
    if (normalized === "IMEDIATA") return "URGENTE";
    return PRIORIDADES_MANUTENCAO.includes(normalized) ? normalized : "MEDIA";
  }

  static summarizeModeloPredicao(avaliacaoModelo) {
    const modelo = avaliacaoModelo?.modeloIntegridade;
    if (!modelo) return null;

    return {
      r2: Number.isFinite(Number(modelo.score?.r2)) ? Number(Number(modelo.score.r2).toFixed(2)) : null,
      slope: Number.isFinite(Number(modelo.slope)) ? Number(Number(modelo.slope).toFixed(4)) : null,
      intercept: Number.isFinite(Number(modelo.intercept)) ? Number(Number(modelo.intercept).toFixed(2)) : null,
      pontosUsados: modelo.pontosUsados,
      janelaHorasCoberta: Number.isFinite(Number(modelo.janelaHorasCoberta))
        ? Number(Number(modelo.janelaHorasCoberta).toFixed(2))
        : null,
      ultimoPontoEm: modelo.ultimoPontoEm
    };
  }

  static async create({
    alertaId,
    maquinaId,
    usuarioId,
    tipo,
    titulo,
    prioridade,
    dataAgendada,
    observacao
  }) {
    const usuarioIdNum = parseInt(usuarioId);
    const tipoNormalizado = String(tipo || (alertaId ? "CORRETIVA" : "PREVENTIVA")).trim().toUpperCase();

    if (Number.isNaN(usuarioIdNum)) {
      throw new AppError("Ids informados sao invalidos!", 400);
    }

    if (!this.TIPOS_VALIDOS.includes(tipoNormalizado)) {
      throw new AppError("Tipo de manutencao invalido!", 400);
    }

    const observacaoNormalizada = this.validateObservacao(observacao);

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
        titulo,
        prioridade,
        dataAgendada,
        observacao: observacaoNormalizada
      });
    }

    return await this.createCorretiva({
      alertaId,
      usuarioId: usuarioIdNum,
      titulo,
      prioridade,
      observacao: observacaoNormalizada
    });
  }

  static async createCorretiva({ alertaId, usuarioId, titulo, prioridade, observacao }) {
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
    const manutencaoEmAberto = manutencoesDoAlerta.some((manutencao) => ["AGENDADA", "EM_ANDAMENTO"].includes(manutencao.status));

    if (manutencaoEmAberto) {
      throw new AppError("Ja existe uma manutencao em aberto para este alerta!", 400);
    }

    const tituloNormalizado = this.validateTitulo(titulo, buildMaintenanceTitle({
      tipo: "CORRETIVA",
      origem: "ALERTA",
      maquinaNome: alerta.maquina?.nome
    }));

    const manutencao = await ManutecaoModel.createWithAlertSync({
      alertaId: alertaIdNum,
      usuarioId,
      titulo: tituloNormalizado,
      prioridade: this.validatePrioridade(prioridade),
      origem: "ALERTA",
      observacao,
      status: this.STATUS_CRIACAO,
      concluidaEm: null,
      cumprimentoAgendamento: CUMPRIMENTO_AGENDAMENTO.NAO_APLICAVEL
    });

    logger.info("manutencao_created", {
      manutencaoId: manutencao.id,
      alertaId: alertaIdNum,
      maquinaId: alerta.maquinaId,
      usuarioId,
      tipo: "CORRETIVA",
      status: manutencao.status
    });

    return this.enrich(manutencao);
  }

  static async createPreventiva({ maquinaId, usuarioId, titulo, prioridade, dataAgendada, observacao }) {
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

    const dataAgendadaNormalizada = dataAgendada == null ? null : this.validateFutureDate(dataAgendada);
    const status = dataAgendadaNormalizada ? "AGENDADA" : this.STATUS_CRIACAO;
    const tituloNormalizado = this.validateTitulo(titulo, buildMaintenanceTitle({
      tipo: "PREVENTIVA",
      origem: "MANUAL",
      maquinaNome: maquina.nome
    }));

    const manutencao = await ManutecaoModel.create({
      alertaId: null,
      maquinaId: maquinaIdNum,
      usuarioId,
      tipo: "PREVENTIVA",
      titulo: tituloNormalizado,
      prioridade: this.validatePrioridade(prioridade),
      origem: "MANUAL",
      observacao,
      status,
      dataAgendada: dataAgendadaNormalizada,
      janelaAgendadaInicio: null,
      janelaAgendadaFim: null,
      concluidaEm: null,
      cumprimentoAgendamento: CUMPRIMENTO_AGENDAMENTO.NAO_APLICAVEL,
      metadataPredicao: null
    });

    logger.info("manutencao_created", {
      manutencaoId: manutencao.id,
      alertaId: null,
      maquinaId: maquinaIdNum,
      usuarioId,
      tipo: "PREVENTIVA",
      status: manutencao.status
    });

    return this.enrich(manutencao);
  }

  static async syncPreventivaPreditiva(diagnostico) {
    const maquina = diagnostico?.maquina;
    if (!maquina?.id) return null;

    const existente = await ManutecaoModel.findOpenPredictiveByMaquinaId(maquina.id);

    if (diagnostico.estadoPredicao !== "PREVISAO_VALIDA") {
      return existente ? this.enrich(existente) : null;
    }

    const dataAgendada = diagnostico.janelaManuInicio || diagnostico.dataInicioManutencao;
    if (!dataAgendada) return existente ? this.enrich(existente) : null;

    const metadataPredicao = {
      estadoPredicao: diagnostico.estadoPredicao,
      fonteDecisao: diagnostico.fonteDecisao,
      urgencia: diagnostico.urgencia,
      motivo: diagnostico.motivo,
      previsaoManutencao: diagnostico.dataFalha ? diagnostico.dataFalha.toISOString() : null,
      modeloIntegridade: this.summarizeModeloPredicao(diagnostico.avaliacaoModelo)
    };

    const payload = {
      titulo: buildMaintenanceTitle({
        tipo: "PREVENTIVA",
        origem: "PREDICAO",
        maquinaNome: maquina.nome
      }),
      prioridade: this.mapPredicaoPrioridade(diagnostico.urgencia),
      dataAgendada,
      janelaAgendadaInicio: diagnostico.janelaManuInicio,
      janelaAgendadaFim: diagnostico.janelaManuFim,
      metadataPredicao
    };

    if (existente) {
      if (existente.status !== "AGENDADA") {
        return this.enrich(existente);
      }

      const atualizada = await ManutecaoModel.update({
        id: existente.id,
        dados: payload
      });

      return this.enrich(atualizada);
    }

    const criada = await ManutecaoModel.create({
      alertaId: null,
      maquinaId: maquina.id,
      usuarioId: null,
      tipo: "PREVENTIVA",
      origem: "PREDICAO",
      observacao: "Manutencao preventiva criada automaticamente pela predicao.",
      status: "AGENDADA",
      concluidaEm: null,
      cumprimentoAgendamento: CUMPRIMENTO_AGENDAMENTO.NAO_APLICAVEL,
      ...payload
    });

    return this.enrich(criada);
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
    return { dados: this.enrich(dados), total, page: pageNum, totalPages };
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

    return this.enrich(await ManutecaoModel.findByAlertaId(alertaId));
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

    return this.enrich(manutencao);
  }

  static assertTransition({ atual, novo, tipo }) {
    if (!novo || novo === atual) return;

    if (this.STATUS_FINAIS.includes(atual)) {
      throw new AppError("Manutencao encerrada nao pode mais ser alterada!", 409);
    }

    if (tipo === "CORRETIVA" && novo === "CANCELADA") {
      throw new AppError("Manutencao corretiva nao pode ser cancelada por este fluxo!", 400);
    }

    if (atual === "AGENDADA" && !["EM_ANDAMENTO", "CANCELADA"].includes(novo)) {
      throw new AppError("Manutencao agendada deve ser iniciada ou cancelada antes de ser concluida!", 409);
    }

    if (atual === "EM_ANDAMENTO" && novo === "AGENDADA") {
      throw new AppError("Manutencao em andamento nao pode voltar para agendada!", 409);
    }
  }

  static assertUpdatePermission({ usuario, manutencao, novoStatus }) {
    if (usuario.role !== ROLES.TECNICO) {
      throw new AppError("Apenas tecnicos podem alterar manutencoes!", 403);
    }

    if (manutencao.usuarioId == null && manutencao.status === "AGENDADA" && novoStatus === "EM_ANDAMENTO") {
      return;
    }

    if (usuario.id !== manutencao.usuarioId) {
      throw new AppError("Voce nao tem permissao para alterar a manutencao de outro tecnico!", 403);
    }
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

    if (this.STATUS_FINAIS.includes(manutencao.status)) {
      throw new AppError("Manutencao encerrada nao pode mais ser alterada!", 409);
    }

    const usuario = await UsuarioModel.findById(usuarioIdNum);
    if (!usuario) {
      throw new AppError("Usuario nao encontrado!", 404);
    }

    const novoStatus = dados.status === undefined ? undefined : String(dados.status).trim().toUpperCase();
    this.assertUpdatePermission({ usuario, manutencao, novoStatus });

    const dadosAtualizados = {};

    if (dados.observacao !== undefined) {
      dadosAtualizados.observacao = this.validateObservacao(dados.observacao);
    }

    if (dados.titulo !== undefined) {
      dadosAtualizados.titulo = this.validateTitulo(dados.titulo, manutencao.titulo);
    }

    if (dados.prioridade !== undefined) {
      dadosAtualizados.prioridade = this.validatePrioridade(dados.prioridade);
    }

    if (dados.dataAgendada !== undefined) {
      if (manutencao.status !== "AGENDADA") {
        throw new AppError("Data agendada so pode ser alterada enquanto a manutencao esta agendada!", 409);
      }

      dadosAtualizados.dataAgendada = this.validateFutureDate(dados.dataAgendada);
    }

    if (novoStatus !== undefined) {
      if (!this.STATUS_VALIDOS.includes(novoStatus)) {
        throw new AppError("Status nao e valido!", 400);
      }

      this.assertTransition({ atual: manutencao.status, novo: novoStatus, tipo: manutencao.tipo });
      dadosAtualizados.status = novoStatus;

      if (manutencao.usuarioId == null && manutencao.status === "AGENDADA" && novoStatus === "EM_ANDAMENTO") {
        dadosAtualizados.usuarioId = usuarioIdNum;
      }

      if (novoStatus === "RESOLVIDO") {
        Object.assign(dadosAtualizados, this.buildConcludedFields({
          dataAgendada: manutencao.dataAgendada,
          status: novoStatus
        }));
      }

      if (novoStatus === "ENCERRADO_SEM_SOLUCAO" || novoStatus === "CANCELADA") {
        dadosAtualizados.concluidaEm = null;
        dadosAtualizados.cumprimentoAgendamento = CUMPRIMENTO_AGENDAMENTO.NAO_APLICAVEL;
      }
    }

    if (Object.keys(dadosAtualizados).length === 0) {
      throw new AppError("Nenhum dado valido foi enviado para atualizacao!", 400);
    }

    const usuarioEventoId = dadosAtualizados.usuarioId || manutencao.usuarioId || usuarioIdNum;
    const manutencaoAtualizada = manutencao.tipo === "PREVENTIVA"
      ? await ManutecaoModel.updatePreventiva({
          manutencaoId,
          dados: dadosAtualizados
        })
      : await ManutecaoModel.updateWithAlertSync({
          manutencaoId,
          alertaId: manutencao.alertaId,
          usuarioId: usuarioEventoId,
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
      usuarioId: usuarioEventoId,
      tipo: manutencao.tipo,
      camposAtualizados: Object.keys(dadosAtualizados),
      status: manutencaoAtualizada.status
    });

    return this.enrich(manutencaoAtualizada);
  }
}

module.exports = ManutecaoService;
