const EmailService = require("../services/emailService");

class ContatoController {
    static async send(req, res, next) {
        try {
            const { nome, email, assunto, mensagem } = req.body;

            const response = await EmailService.sendContactEmail({
                nome,
                email,
                assunto,
                mensagem,
            });

            return res.status(200).json({
                mensagem: "Email enviado com sucesso!",
                data: response,
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = ContatoController;