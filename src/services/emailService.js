const { Resend } = require("resend");
const AppError = require("../utils/appErrorUtils");

class EmailService {
    static getClient() {
        const apiKey = process.env.RESEND_API_KEY;

        if (!apiKey) {
            throw new AppError("Resend não está configurado neste ambiente!", 500);
        }

        return new Resend(apiKey);
    }

    static async sendContactEmail({ nome, email, assunto, mensagem }) {
        if (!nome || nome.trim().length < 3) {
            throw new AppError("Nome inválido!", 400);
        }

        if (!email || !/^[\\w\\-.]+@([\\w-]+\\.)+[\\w-]{2,}$/.test(email)) {
            throw new AppError("Email inválido!", 400);
        }

        if (!assunto || assunto.trim().length < 3) {
            throw new AppError("Assunto inválido!", 400);
        }

        if (!mensagem || mensagem.trim().length < 10) {
            throw new AppError("Mensagem inválida!", 400);
        }

        const resend = this.getClient();

        const { data, error } = await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL,
            to: [process.env.CONTACT_TO_EMAIL],
            replyTo: email.trim(),
            subject: `[Fale Conosco] ${assunto.trim()}`,
            html: `
                <h2>Novo contato pelo site</h2>
                <p><strong>Nome:</strong> ${nome.trim()}</p>
                <p><strong>Email:</strong> ${email.trim()}</p>
                <p><strong>Assunto:</strong> ${assunto.trim()}</p>
                <p><strong>Mensagem:</strong></p>
                <p>${mensagem.trim()}</p>
            `,
        });

        if (error) {
            throw new AppError("Falha ao enviar email pelo Resend.", 502);
        }

        return data;
    }
}

module.exports = EmailService;