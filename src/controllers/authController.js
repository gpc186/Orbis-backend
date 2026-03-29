const UsuarioService = require("../services/usuarioService");

class authController {
    static async login(req, res, next){
        try {
            const { email, senha } = req.body;
            const resultado = await UsuarioService.login({ email, senha })
            return res.status(200).json(resultado);
        } catch (error) {
            next(error);
        };
    }

    static async refresh(req, res, next){
        try {
            const { token } = req.body;
            const resultado = await UsuarioService.refresh(token)
            return res.status(200).json(resultado)
        } catch (error) {
            next(error)
        }
    }

    static async logout(req, res, next){
        try {
            const { token } = req.body;
            const resultado = await UsuarioService.logout(token);
            return res.status(200).json(resultado);
        } catch (error) {
            next(error);
        };
    };
}

module.exports = authController