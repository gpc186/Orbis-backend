const UsuarioService = require("../services/usuarioService");

class TecnicoController {
    static async list(req, res, next){
        try {
            const { page, limit } = req.query;
            const response = await UsuarioService.listAllTecnicos({ page, limit});
            return res.status(200).json(response);
        } catch (error) {
            next(error);
        };
    };

    static async findById(req, res, next){
        try {
            const { id } = req.params;
            const response = await UsuarioService.findTecnicoById(id);
            return res.status(200).json(response);
        } catch (error) {
            next(error);
        };
    };

    static async findAlertasByTecnico(req, res, next){
        try {
            const { id } = req.params;
            const { page, limit } = req.query;
            const response = await UsuarioService.findAlertasByTecnicoId(id, { page, limit });
            return res.status(200).json(response);
        } catch (error) {
            next(error);
        };
    };
};

module.exports = TecnicoController;