const RefreshTokenModel = require("../models/refreshTokenModel");
const UsuarioModel = require("../models/usuarioModel");
const AppError = require("../utils/appErrorUtils");
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { generateAccessToken, generateRefreshTokenData } = require("../utils/jwtUtils");

class UsuarioService {
    /**
     * Faz o login do usuário, fazendo verificação de email, senha, e cria um regfreshToken e access token novo e retorna
     * @param {string} email
     * @param {string} senha
     * @returns {Promise<Object|Null>} Os dados do `usuario`, junto ao `accessToken`, e omite a senha
     * @example
     * const usuarioFeitoLogin = await UsuarioService.login(req.body)
     */
    static async login({ email, senha }) {
        const usuario = await UsuarioModel.findByEmail(email);

        if (!usuario) {
            throw new AppError("Email ou senha incorretas!", 401);
        };

        const senhaValida = await bcrypt.compare(senha, usuario.senha)

        if (!senhaValida) {
            throw new AppError("Email ou senha incorretos!", 401);
        };

        const accessToken = generateAccessToken({ id: usuario.id, role: usuario.role });

        const { token, expiresAt } = generateRefreshTokenData()

        const refreshToken = await RefreshTokenModel.create({ usuarioId: usuario.id, token, expiresAt });

        return { usuario, accessToken, refreshToken}
    };
}