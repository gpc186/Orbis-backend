const ManutecaoService = require("../services/manutencaoService");

class ManutecaoController {
    static async create(req, res, next){
        try {
            const { alertaId, observacao, status } = req.body;
            const usuarioId = req.usuario.id;
            const response = await ManutecaoService.create({alertaId, usuarioId, observacao, status});
            return res.status(201).json(response);
        } catch (error) {
            next(error);
        };
    };

    static async findById(req, res, next){
        try {
            const { id } = req.params;
            const response = await ManutecaoService.findById(id);
            return res.status(200).json(response);
        } catch (error) {
            next(error);
        };
    };

    static async findByAlertaId(req, res, next){
        try {
            const { alertaId } = req.params;
            const response = await ManutecaoService.findByalertaId(alertaId);
            return res.status(200).json(response);
        } catch (error) {
            next(error);
        };
    };

    static async update(req, res, next){
        try {
            const { id } = req.params;
            const response = await ManutecaoService.update(id, {dados: req.body});
            return res.status(200).json(response);
        } catch (error) {
            next(error);
        };
    };

    static async list(req, res, next){
        try {
            const { page, limit } = req.query;
            const response = await ManutecaoService.list({ page, limit});
            return res.status(200).json(response);
        } catch (error) {
            next(error);
        };
    };
};

module.exports = ManutecaoController;