const RelatorioAgendamentoService = require("../services/relatorioAgendamentoService");
const RelatorioExecucaoService = require("../services/relatorioExecucaoService");

class RelatorioAgendamentoController {
  static async preview(req, res, next) {
    try {
      const result = await RelatorioAgendamentoService.preview({
        usuario: req.usuario,
        payload: req.body
      });

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }

  static async create(req, res, next) {
    try {
      const result = await RelatorioAgendamentoService.create({
        usuario: req.usuario,
        payload: req.body
      });

      return res.status(201).json({
        message: "Agendamento de relatorio criado com sucesso.",
        ...result
      });
    } catch (error) {
      return next(error);
    }
  }

  static async list(req, res, next) {
    try {
      const result = await RelatorioAgendamentoService.list({
        usuario: req.usuario
      });

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }

  static async findById(req, res, next) {
    try {
      const result = await RelatorioAgendamentoService.findById({
        usuario: req.usuario,
        id: req.params.id
      });

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const result = await RelatorioAgendamentoService.update({
        usuario: req.usuario,
        id: req.params.id,
        payload: req.body
      });

      return res.status(200).json({
        message: "Agendamento de relatorio atualizado com sucesso.",
        ...result
      });
    } catch (error) {
      return next(error);
    }
  }

  static async updateStatus(req, res, next) {
    try {
      const result = await RelatorioAgendamentoService.updateStatus({
        usuario: req.usuario,
        id: req.params.id,
        payload: req.body
      });

      return res.status(200).json({
        message: "Status do agendamento atualizado com sucesso.",
        ...result
      });
    } catch (error) {
      return next(error);
    }
  }

  static async executeNow(req, res, next) {
    try {
      const result = await RelatorioAgendamentoService.executeNow({
        usuario: req.usuario,
        id: req.params.id
      });

      return res.status(200).json({
        message: "Execucao manual do agendamento concluida.",
        ...result
      });
    } catch (error) {
      return next(error);
    }
  }

  static async listExecutions(req, res, next) {
    try {
      const result = await RelatorioExecucaoService.listExecutions(req.params.id);
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = RelatorioAgendamentoController;
