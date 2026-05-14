const ResetSenhaService = require("../services/resetSenhaService");

class ResetSenhaController {
    static async esqueciSenha(req, res, next) {
        try {
            const { email, emailDestino } = req.body;
            const response = await ResetSenhaService.esqueceuSenha({ email, emailDestino });
            return res.status(200).json(response);
        } catch (error) {
            return next(error);
        }
    }

    static async validarCodigo(req, res, next) {
        try {
            const { email, code } = req.body;
            const response = await ResetSenhaService.validarCodigo({ email, code });
            return res.status(200).json(response);
        } catch (error) {
            return next(error);
        }
    }

    static async redefinirSenha(req, res, next) {
        try {
            const { email, code, novaSenha } = req.body;
            const response = await ResetSenhaService.redefinirSenha({ email, code, novaSenha });
            return res.status(200).json(response);
        } catch (error) {
            return next(error);
        }
    }

    static async solicitarAlteracaoSenha(req, res, next){
        try {
            const { id } = req.usuario;
            const { senhaAtual, emailDestino } = req.body;
            const response = await ResetSenhaService.solicitarAlteracao({ id, senhaAtual, emailDestino });
            return res.status(200).json(response);
        } catch (error) {
            return next(error);
        }
    }

    static async confirmarAlteracaoSenha(req, res, next){
        try {
            const { id } = req.usuario;
            const { code, novaSenha } = req.body;
            const response = await ResetSenhaService.confirmarAlteracao({ id, code, novaSenha });
            return res.status(200).json(response);
        } catch (error) {
            return next(error);
        }
    }
}

module.exports = ResetSenhaController