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
     * @returns  Os dados do `usuario`, junto ao `accessToken`, e omite a senha
     * @example
     * const usuarioFeitoLogin = await UsuarioService.login(req.body)
     */
    static async login({ email, senha }) {
        const usuario = await UsuarioModel.findByEmail(email);

        if (!usuario) {
            throw new AppError("Email ou senha incorretas!", 401);
        };

        const { senha: _, ...usuarioSemSenha } = usuario

        const senhaValida = await bcrypt.compare(senha, usuario.senha)

        if (!senhaValida) {
            throw new AppError("Email ou senha incorretos!", 401);
        };

        const accessToken = generateAccessToken({ id: usuario.id, role: usuario.role });

        const { token, expiresAt } = generateRefreshTokenData()

        const refreshToken = await RefreshTokenModel.create({ usuarioId: usuario.id, token, expiresAt });

        return { usuarioSemSenha, accessToken, refreshToken: refreshToken.token }
    };
    /**
     * Faz o registro no banco de dados do usuário
     * @param {string} nome
     * @param {string} email
     * @param {string} senha
     * @param {string} role
     * @returns  Retorna os dados do usuário que criou
     * @example
     * const usuarioNovo = await UsuarioService.register({ nome, email, senha, role })
     */
    static async register({ nome, email, senha, role }) {
        if (nome.length < 3) {
            throw new AppError("Nome inválido!", 400);
        };

        if (!/^[\w\-\.]+@([\w-]+\.)+[\w-]{2,}$/gm.test(email)) {
            throw new AppError("Email inválido!", 400);
        };

        const emailExist = await UsuarioModel.findByEmail(email);

        if (emailExist) {
            throw new AppError("Credenciais inválidas!", 400);
        };

        if (role !== "ADMIN" && role !== "TECNICO") {
            throw new AppError("Credenciais inválidas!", 400);
        };

        const senhaHash = await bcrypt.hash(senha, 10);

        const usuario = await UsuarioModel.create({ nome, email, senha: senhaHash, role });

        return { usuario }
    };
    /**
     * Pega o `refreshToken` para verificar se ainda é valido e retorna o `accessToken` caso for
     * @param {string} token 
     * @returns  retorna o `accessToken`
     * @example
     * const tokenNovo = await UsuarioService.refresh(token);
     */
    static async refresh(token) {
        const refreshToken = await RefreshTokenModel.findByToken(token);

        if (!refreshToken) {
            throw new AppError("Token não é válido!", 401);
        };

        const agora = new Date();

        if (refreshToken.expiresAt < agora) {
            throw new AppError("Token Já expirou!", 401)
        }

        const usuario = await UsuarioModel.findById(refreshToken.usuarioId);

        if (!usuario.ativo) {
            throw new AppError("Não foi encontrado o usuario!", 404);
        };

        const accessToken = generateAccessToken({ id: usuario.id, role: usuario.role });

        return { accessToken }
    }
    /**
     * Faz o logout do usuario utilizando o refreshToken
     * @param {string} token 
     * @returns  mensagem: "Token deletado com sucesso!"
     * @example
     * const mensagemLogout = await UsuarioService.logout(token);
     */
    static async logout(token) {
        const refreshToken = await RefreshTokenModel.findByToken(token);

        if (!refreshToken) {
            throw new AppError("Token não válido!", 401);
        };

        await RefreshTokenModel.delete(token);

        return { mensagem: "Token deletado com sucesso!" }
    }
    /**
     * Retorna todos os usuarios com uma função de paginação com o `page` e `limit`
     * @param {number} page
     * @param {number} limit 
     * @returns  Um array contendo os dados de todos os usuários
     * @example 
     * const { dados } = await UsuarioService.list({page, limit})
     */
    static async list({ page, limit }) {
        const pageNum = parseInt(page)
        const take = parseInt(limit)
        const skip = (pageNum - 1) * take
        const [dados, total] = await Promise.all([
            UsuarioModel.findAll({ skip, take }),
            UsuarioModel.count()
        ])

        const totalPages = Math.ceil(total / limit);

        return { dados, total, page: pageNum, totalPages };
    };

    static async listAllTecnicos({ page, limit }) {
        const pageNum = parseInt(page)
        const take = parseInt(limit)
        const skip = (pageNum - 1) * take
        const [dados, total] = await Promise.all([
            UsuarioModel.findAllTecnicos({ skip, take }),
            UsuarioModel.countTecnicos()
        ])

        const totalPages = Math.ceil(total / limit);

        return { dados, total, page: pageNum, totalPages };
    };
    // TODO: Colocar essa função no service de alerta
    static async findAlertasByTecnicoId(id, { page, limit }) {
        const pageNum = parseInt(page)
        const take = parseInt(limit)
        const tecnicoId = id
        const skip = (pageNum - 1) * take
        const [dados, total] = await Promise.all([
            UsuarioModel.findAlertasByTecnicoId(tecnicoId, { skip, take }),
            UsuarioModel.countAlertasByTecnico(tecnicoId)
        ])

        const totalPages = Math.ceil(total / limit);

        return { dados, total, page: pageNum, totalPages };
    }

    /**
     * Retorna todos os dados do usuario pelo id
     * @param {number} id 
     * @returns  Os dados do usuario
     * @example
     * const usuario = await UsuarioModel.findById(id);
     */
    static async findById(id) {
        const usuario = await UsuarioModel.findById(parseInt(id));
        if (!usuario) {
            throw new AppError("Usuario não encontrado!", 404);
        };
        return usuario;
    };
    // TODO: Colocar o model dentro da função no model de alerta
    static async findTecnicoById(id) {
        const tecnico = await UsuarioModel.findById(id);

        if(!tecnico){
            throw new AppError("Tecnico não encontrado!", 404);
        };
        
        const status = await UsuarioModel.findAlertaStatusOfTecnicoById(id);

        const alertaEmAndamento = status ? true : false

        return { ...tecnico, alertaEmAndamento }
    }

    static async countActiveTecnicos(){
        return await UsuarioModel.countActiveTecnico()
    }

    /**
     * Pega os dados do usuario e faz um update, junto com verificações extras
     * @param {number} id 
     * @param {string} nome
     * @param {string} role
     * @param {string} especialidade
     * @param {number} telefone
     * @example 
     * const usuarioAtualizado = await UsuarioService.update({ id, dados })
     */
    static async update({ id, dados }) {
        const { nome, role, especialidade, telefone } = dados;
        const usuario = await UsuarioModel.findById(parseInt(id));

        if (!usuario) {
            throw new AppError("Usuario não encontrado!", 404);
        };

        if (usuario.role === "ADMIN" && role === "TECNICO") {
            const countAdmin = await UsuarioModel.countAdmins();
            if (countAdmin == 1) {
                throw new AppError("Não é possivel rebaixar o ultimo admin!", 409);
            };
        };

        if (nome && nome.length < 3) {
            throw new AppError("Nome inválido!", 400);
        };

        if (especialidade && especialidade.length < 2) {
            throw new AppError("Especialidade invalida!", 400);
        };

        if (telefone && !/^(\(?[0-9]{2}\)?)? ?([0-9]{4,5})-?([0-9]{4})$/gm.test(telefone)) {
            throw new AppError("Telefone inválido!", 400);
        };

        const dadosParaAtualizar = {};

        if (nome !== undefined) dadosParaAtualizar.nome = nome;
        if (role !== undefined) dadosParaAtualizar.role = role;
        if (especialidade !== undefined) dadosParaAtualizar.especialidade = especialidade;
        if (telefone !== undefined) dadosParaAtualizar.telefone = telefone;

        const usuarioAtualizado = await UsuarioModel.update({ id, dadosParaAtualizar });

        return usuarioAtualizado;
    }

    static async delete(id) {
        const usuario = await UsuarioModel.findById(parseInt(id));
        if (!usuario) {
            throw new AppError("Usuario não encontrado!", 404);
        };

        if (usuario.role === "ADMIN") {
            throw new AppError("Você não pode deletar outro admin!", 409);
        };

        await UsuarioModel.delete(parseInt(id));

        return { mensagem: "Usuario deletado com sucesso!" };
    };

};

module.exports = UsuarioService;