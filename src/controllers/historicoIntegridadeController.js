const HistoricoIntegridadeService = require('../services/historicoIntegridadeService');

class HistoricoIntegridadeController {
    static async store(req, res, next) {
        try {
            const historico = await HistoricoIntegridadeService.create(req.body);
            return res.status(201).json(historico);
        } catch (error) {
            next(error);
        }
    }

    static async index(req, res, next) {
        try {
            const historico = await HistoricoIntegridadeService.list(req.query);
            return res.status(200).json(historico);
        } catch (error) {
            next(error);
        }
    }

    static async listByMaquina(req, res, next) {
        try {
            const historico = await HistoricoIntegridadeService.listByMaquina(req.params.id, req.query);
            return res.status(200).json(historico);
        } catch (error) {
            next(error);
        }
    }

    static async show(req, res, next) {
        try {
            const historico = await HistoricoIntegridadeService.findById(req.params.id);
            return res.status(200).json(historico);
        } catch (error) {
            next(error);
        }
    }
}

module.exports = HistoricoIntegridadeController;
