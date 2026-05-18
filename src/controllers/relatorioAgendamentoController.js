const RelatorioAgendamentoService = require("../services/relatorioAgendamentoService");
const RelatorioExecucaoService = require("../services/relatorioExecucaoService");

class RelatorioAgendamentoController {
  static async preview(req, res, next) {
    try {
      const { nome, assunto, periodo, filtros } = req.body;
      const { usuario } = req;

      const result = await RelatorioAgendamentoService.preview({
        usuario,
        payload: { nome, assunto, periodo, filtros }
      });

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }

  static async create(req, res, next) {
    try {
      const { nome, emailsDestino, assunto, periodo, filtros, agendamento } = req.body;
      const { usuario } = req;

      const result = await RelatorioAgendamentoService.create({
        usuario,
        payload: { nome, emailsDestino, assunto, periodo, filtros, agendamento }
      });

      return res.status(201).json({ message: "Agendamento de relatorio criado com sucesso.", ...result });
    } catch (error) {
      return next(error);
    }
  }

  static async list(req, res, next) {
    try {
      const { usuario } = req;
      const result = await RelatorioAgendamentoService.list({ usuario });
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }

  static async findById(req, res, next) {
    try {
      const { id } = req.params;
      const { usuario } = req;

      const result = await RelatorioAgendamentoService.findById({ usuario, id });

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const { id } = req.params;
      const { nome, emailsDestino, assunto, periodo, filtros, agendamento } = req.body;
      const { usuario } = req;

      const result = await RelatorioAgendamentoService.update({
        usuario,
        id,
        payload: { nome, emailsDestino, assunto, periodo, filtros, agendamento }
      });

      return res.status(200).json({ message: "Agendamento de relatorio atualizado com sucesso.", ...result });
    } catch (error) {
      return next(error);
    }
  }

  static async delete(req, res, next) {
    try {
      const { id } = req.params;
      const { usuario } = req;

      const result = await RelatorioAgendamentoService.delete({ usuario, id });

      return res.status(200).json({
        message: "Agendamento de relatorio deletado com sucesso.",
        ...result
      });
    } catch (error) {
      return next(error);
    }
  }

  static async updateStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const { usuario } = req;

      const result = await RelatorioAgendamentoService.updateStatus({ usuario, id, payload: { status } });
      return res.status(200).json({ message: "Status do agendamento atualizado com sucesso.", ...result });
    } catch (error) {
      return next(error);
    }
  }

  static async executeNow(req, res, next) {
    try {
      const { id } = req.params;
      const { usuario } = req;

      const result = await RelatorioAgendamentoService.executeNow({ usuario, id });
      return res.status(200).json({ message: "Execucao manual do agendamento concluida.", ...result });
    } catch (error) {
      return next(error);
    }
  }

  static async listExecutions(req, res, next) {
    try {
      const { id } = req.params;
      const { usuario } = req;

      const result = await RelatorioExecucaoService.listExecutions({ id, usuario });
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = RelatorioAgendamentoController;
