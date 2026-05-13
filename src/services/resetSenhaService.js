const ResetSenhaModel = require("../models/resetSenhaModel");
const UsuarioModel = require("../models/usuarioModel");
const EmailService = require("./emailService");

class ResetSenhaService {
    static async esqueceuSenha({ email, emailDestino }) {
        if (!email || !emailDestino) {
            throw new AppError("Dados inválidos.", 400);
        }

        if (!/^[\w\-\.]+@([\w-]+\.)+[\w-]{2,}$/gm.test(email)) {
            throw new AppError("Email inválido!", 400);
        };

        const usuario = await UsuarioModel.findByEmail(email);

        if (!usuario) {
            return { message: "Se o usuário existir, o código será enviado." };
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000)
        await ResetSenhaModel.upsert({ usuarioId: usuario.id, code, emailDestino, expiresAt })

        await EmailService.enviarCodigoRedefinicao({
            para: emailDestino,
            nome: usuario.nome,
            code
        });

        return { message: "Se o usuário existir, o código será enviado." };
    }

    static async validarCodigo({ email, code }) {
        if (!email || !code) {
            throw new AppError("Dados inválidos.", 400);
        }

        const usuario = await UsuarioModel.findByEmail(email);

        if (!usuario) {
            throw new AppError("Código inválido.", 400);
        }

        const resetCode = await ResetSenhaModel.findByUsuarioId(usuario.id);

        if (!resetCode || resetCode.code !== code) {
            throw new AppError("Código inválido.", 400);
        }

        if (resetCode.expiresAt < new Date()) {
            throw new AppError("Código expirado.", 400);
        }

        return { message: "Código válido." };
    }

    static async redefinirSenha({ email, code, novaSenha }) {
        if (!email || !code || !novaSenha) {
            throw new AppError("Dados inválidos.", 400);
        }

        const usuario = await UsuarioModel.findByEmail(email)

        if (!usuario) {
            throw new AppError("Código inválido.", 400);
        }

        const resetCode = await ResetSenhaModel.findByUsuarioId(usuario.id);

        if (!resetCode || resetCode.code !== code) {
            throw new AppError("Código inválido.", 400);
        }

        if (resetCode.expiresAt < new Date()) {
            throw new AppError("Código expirado.", 400);
        }

        const senhaHash = await bcrypt.hash(novaSenha, 10);

        await UsuarioModel.updateSenha(usuario.id, senhaHash)

        await ResetSenhaModel.deleteByUsuarioId(usuario.id)

        return { message: "Senha redefinida com sucesso." };
    }
}

module.exports = ResetSenhaService