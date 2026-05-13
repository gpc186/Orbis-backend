const ResetSenhaService = require("../services/resetSenhaService");

class ResetSenhaController {
    static async resetarSenha(req, res, next){
        try {
            const { email, emailDestino } = req.body;
            const response = await ResetSenhaService.esqueceuSenha({ email, emailDestino });
            return res.status(200).json(response)
        } catch (error) {
            return next(error)
        }
    }
}

module.exports = ResetSenhaController