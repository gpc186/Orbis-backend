const UsuarioService = require("../services/usuarioService");

class UsuarioController {
    static async list(req, res, next){
        try {
            const { page, limit } = req.query;
            const resultado = await UsuarioService.list({page, limit});
            return res.status(200).json(resultado);
        } catch (error) {
            next(error);
        };
    }

    static async findById(req, res, next){
        try {
            const { id } = req.params;
            const resultado = await UsuarioService.findById(id);
            return res.status(200).json(resultado);
        } catch (error) {
            next(error);
        };
    };

    static async update(req, res, next){
        try {
            const { id } = req.params;
            const resultado = await UsuarioService.update({ id, dados: req.body });
            return res.status(200).json(resultado);
        } catch (error) {
            next(error);
        };
    };

    static async register(req, res, next){
        try {
            const { nome, email, senha, role } = req.body
            const resultado = await UsuarioService.register({nome, email, senha, role});
            return res.status(201).json(resultado);
        } catch (error) {
            next(error)
        }
    };

    static async delete(req, res, next){
        try {
            const { id } = req.params;
            const resultado = await UsuarioService.delete(id);
            return res.status(200).json(resultado);
        } catch (error) {
            next(error);
        };
    };
};

module.exports = UsuarioController;