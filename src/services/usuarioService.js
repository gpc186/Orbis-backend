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
    /**
     * Faz o registro no banco de dados do usuário
     * @param {string} nome
     * @param {string} email
     * @param {string} senha
     * @param {string} role
     * @returns {Promise<Object|null>} Retorna os dados do usuário que criou
     * @example
     * const usuarioNovo = await UsuarioService.register({ nome, email, senha, role })
     */
    static async register({ nome, email, senha, role }){
        if(nome.length < 3){
            throw new AppError("Nome inválido!", 400);
        };

        if(!email.test(/^[\w\-\.]+@([\w-]+\.)+[\w-]{2,}$/gm)){
            throw new AppError("Email inválido!", 400);
        };

        const emailExist = await UsuarioModel.findByEmail(email);
        
        if(emailExist){
            throw new AppError("Credenciais inválidas!", 400);
        };

        if(role !== "ADMIN" || role !== "TECNICO"){
            throw new AppError("Credenciais inválidas!", 400);
        };

        const senhaHash = await bcrypt.hash(senha, 10);

        const usuario = await UsuarioModel.create({ nome, email, senhaHash, role });

        return { usuario }
    };

    
};

module.exports = UsuarioService;