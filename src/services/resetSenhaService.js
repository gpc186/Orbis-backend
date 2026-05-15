const ResetSenhaModel = require("../models/resetSenhaModel");
const UsuarioModel = require("../models/usuarioModel");
const AppError = require("../utils/appErrorUtils");
const EmailService = require("./emailService");
const bcrypt = require('bcrypt');
class ResetSenhaService {
    static async esqueceuSenha({ email, emailDestino }) {
        if (!email || !emailDestino) {
            throw new AppError("Dados inválidos.", 400);
        }

        if (!/^[\w\-\.]+@([\w-]+\.)+[\w-]{2,}$/gm.test(email) || !/^[\w\-\.]+@([\w-]+\.)+[\w-]{2,}$/gm.test(emailDestino)) {
            throw new AppError("Email inválido!", 400);
        };

        const usuario = await UsuarioModel.findByEmail(email);

        if (!usuario) {
            return { message: "Se o usuário existir, o código será enviado." };
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000)
        await ResetSenhaModel.upsert({ usuarioId: usuario.id, code, emailDestino, expiresAt })

        const html = `
        <h2>Olá, ${usuario.nome}!</h2>
        <p>Seu código para redefinir a senha é:</p>
        <h1 style="letter-spacing: 8px; color: #3182ce;">${code}</h1>
        <p>Este código expira em <strong>15 minutos</strong>.</p>
        <p>Se você não solicitou isso, ignore este email.</p>
        `

        await EmailService.send({ to: emailDestino, subject: "Código de redefinição de senha — Orbis", html })

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

    static async solicitarAlteracao({ id, senhaAtual, emailDestino }) {
        if (!senhaAtual || !emailDestino) {
            throw new AppError("Dados inválidos.", 400);
        }

        const usuario = await UsuarioModel.findByIdWithSenha(id);
        if (!usuario) {
            throw new AppError("Usuário não encontrado.", 404);
        }

        const senhaCorreta = await bcrypt.compare(senhaAtual, usuario.senha);
        if (!senhaCorreta) {
            throw new AppError("Senha atual incorreta.", 400);
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();

        await ResetSenhaModel.upsert({
            usuarioId: usuario.id,
            code,
            emailDestino,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000)
        });

        const html = `
        <h2>Olá, ${usuario.nome}!</h2>
        <p>Seu código para redefinir a senha é:</p>
        <h1 style="letter-spacing: 8px; color: #3182ce;">${code}</h1>
        <p>Este código expira em <strong>15 minutos</strong>.</p>
        <p>Se você não solicitou isso, ignore este email.</p>
        `

        await EmailService.send({ to: emailDestino, subject: "Código de redefinição de senha — Orbis", html })

        return { message: "Código enviado para o email informado." };
    }

    static async confirmarAlteracao({ id, code, novaSenha }) {
        if (!code || !novaSenha) {
            throw new AppError("Dados inválidos.", 400);
        }

        const usuario = await UsuarioModel.findByIdWithSenha(id);
        if (!usuario) {
            throw new AppError("Usuário não encontrado.", 404);
        }

        const resetCode = await ResetSenhaModel.findByUsuarioId(usuario.id);

        if (!resetCode || resetCode.code !== code) {
            throw new AppError("Código inválido.", 400);
        }

        if (resetCode.expiresAt < new Date()) {
            throw new AppError("Código expirado.", 400);
        }

        const mesmaSenha = await bcrypt.compare(novaSenha, usuario.senha);
        if (mesmaSenha) {
            throw new AppError("A nova senha deve ser diferente da atual.", 400);
        }

        const senhaHash = await bcrypt.hash(novaSenha, 10);

        await UsuarioModel.updateSenha( usuario.id, senhaHash);

        await ResetSenhaModel.deleteByUsuarioId(usuario.id);

        return { message: "Senha alterada com sucesso." };
    }
}

module.exports = ResetSenhaService