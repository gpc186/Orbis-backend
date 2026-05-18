const RefreshTokenModel = require("../models/refreshTokenModel");
const UsuarioModel = require("../models/usuarioModel");
const AlertaModel = require("../models/alertaModel");
const AppError = require("../utils/appErrorUtils");
const bcrypt = require("bcrypt");
const { generateAccessToken, generateRefreshTokenData } = require("../utils/jwtUtils");
const StorageService = require("./storageService");
const logger = require("../utils/logger");

class UsuarioService {
  static async login({ email, senha }) {
    const usuario = await UsuarioModel.findByEmail(email);

    if (!usuario) {
      logger.warn("auth_login_failed", {
        email,
        reason: "user_not_found"
      });

      throw new AppError("Email ou senha incorretas!", 401);
    }

    const { senha: _, ...usuarioSemSenha } = usuario;
    const senhaValida = await bcrypt.compare(senha, usuario.senha);

    if (!senhaValida) {
      logger.warn("auth_login_failed", {
        email,
        usuarioId: usuario.id,
        reason: "invalid_password"
      });

      throw new AppError("Email ou senha incorretos!", 401);
    }

    const accessToken = generateAccessToken({ id: usuario.id, role: usuario.role });
    const { token, expiresAt } = generateRefreshTokenData();
    const refreshToken = await RefreshTokenModel.create({ usuarioId: usuario.id, token, expiresAt });

    logger.info("auth_login_succeeded", {
      usuarioId: usuario.id,
      role: usuario.role
    });

    return { usuarioSemSenha, accessToken, refreshToken: refreshToken.token };
  }

  static async register({ nome, email, senha, role }) {
    if (nome.length < 3) {
      throw new AppError("Nome invalido!", 400);
    }

    if (!/^[\w\-\.]+@([\w-]+\.)+[\w-]{2,}$/gm.test(email)) {
      throw new AppError("Email invalido!", 400);
    }

    const emailExist = await UsuarioModel.findByEmail(email);
    if (emailExist) {
      throw new AppError("Credenciais invalidas!", 400);
    }

    if (role !== "ADMIN" && role !== "TECNICO") {
      throw new AppError("Credenciais invalidas!", 400);
    }

    if (!senha || typeof senha !== "string") {
      throw new AppError("Senha invalida!", 400);
    }

    if (!/^((?=\S*?[A-Z])(?=\S*?[a-z])(?=\S*?[0-9]).{6,})\S$/.test(senha)) {
      throw new AppError("Senha invalida!", 400);
    }

    const senhaHash = await bcrypt.hash(senha, 10);
    const usuario = await UsuarioModel.create({ nome, email, senha: senhaHash, role });

    return { usuario };
  }

  static async refresh(token) {
    const refreshToken = await RefreshTokenModel.findByToken(token);

    if (!refreshToken) {
      throw new AppError("Token nao e valido!", 401);
    }

    const agora = new Date();
    if (refreshToken.expiresAt < agora) {
      throw new AppError("Token ja expirou!", 401);
    }

    const usuario = await UsuarioModel.findById(refreshToken.usuarioId);
    if (!usuario) {
      throw new AppError("Nao foi encontrado o usuario!", 404);
    }

    const accessToken = generateAccessToken({ id: usuario.id, role: usuario.role });

    logger.info("auth_refresh_succeeded", {
      usuarioId: usuario.id,
      role: usuario.role
    });

    return { accessToken };
  }

  static async logout(token) {
    const refreshToken = await RefreshTokenModel.findByToken(token);

    if (!refreshToken) {
      throw new AppError("Token nao valido!", 401);
    }

    const usuario = await UsuarioModel.findById(refreshToken.usuarioId);
    if (!usuario) {
      throw new AppError("Usuario nao encontrado!", 404);
    }

    await RefreshTokenModel.delete(token);

    logger.info("auth_logout_succeeded", {
      usuarioId: usuario.id,
      role: usuario.role
    });

    return { mensagem: "Token deletado com sucesso!" };
  }

  static async list({ page, limit }) {
    const pageNum = parseInt(page);
    const take = parseInt(limit);
    const skip = (pageNum - 1) * take;
    const [dados, total] = await Promise.all([
      UsuarioModel.findAll({ skip, take }),
      UsuarioModel.count()
    ]);

    const totalPages = Math.ceil(total / limit);
    return { dados, total, page: pageNum, totalPages };
  }

  static async listAllTecnicos({ page, limit }) {
    const pageNum = parseInt(page);
    const take = parseInt(limit);
    const skip = (pageNum - 1) * take;
    const [dados, total] = await Promise.all([
      UsuarioModel.findAllTecnicos({ skip, take }),
      UsuarioModel.countTecnicos()
    ]);

    const totalPages = Math.ceil(total / limit);
    return { dados, total, page: pageNum, totalPages };
  }

  static async findAlertasByTecnicoId(id, { page, limit }) {
    if (!page || !limit) {
      throw new AppError("Paginacao nao usada corretamente!", 400);
    }

    const tecnicoId = parseInt(id);
    const tecnico = await UsuarioModel.findById(tecnicoId);

    if (!tecnico) {
      throw new AppError("Tecnico nao encontrado!", 404);
    }

    if (tecnico.role !== "TECNICO") {
      throw new AppError("Usuario nao e tecnico!", 401);
    }

    const pageNum = parseInt(page);
    const take = parseInt(limit);
    const skip = (pageNum - 1) * take;
    const [dados, total] = await Promise.all([
      AlertaModel.findAlertasByTecnico(tecnicoId, { skip, take }),
      AlertaModel.countAlertasByTecnicoId(tecnicoId)
    ]);

    const totalPages = Math.ceil(total / limit);
    return { dados, total, page: pageNum, totalPages };
  }

  static async findById(id) {
    const usuario = await UsuarioModel.findById(parseInt(id));
    if (!usuario) {
      throw new AppError("Usuario nao encontrado!", 404);
    }

    return usuario;
  }

  static async findTecnicoById(id) {
    const tecnico = await UsuarioModel.findById(id);

    if (!tecnico) {
      throw new AppError("Tecnico nao encontrado!", 404);
    }

    if (tecnico.role !== "TECNICO") {
      throw new AppError("Usuario nao e tecnico!", 403);
    }

    const status = await AlertaModel.findAlertaStatusOfTecnicoById(id);
    const alertaEmAndamento = Boolean(status);

    return { ...tecnico, alertaEmAndamento };
  }

  static async countActiveTecnicos() {
    return await UsuarioModel.countActiveTecnico();
  }

  static async update({ id, dados }) {
    const { nome, role, especialidade, telefone, ativo } = dados;
    const usuario = await UsuarioModel.findById(parseInt(id));

    if (!usuario) {
      throw new AppError("Usuario nao encontrado!", 404);
    }

    if (usuario.role === "ADMIN" && role === "TECNICO") {
      const countAdmin = await UsuarioModel.countAdmins();
      if (countAdmin === 1) {
        throw new AppError("Nao e possivel rebaixar o ultimo admin!", 409);
      }
    }

    if (nome !== undefined && (typeof nome !== "string" || nome.trim().length < 3)) {
      throw new AppError("Nome invalido!", 400);
    }

    if (especialidade !== undefined && (typeof especialidade !== "string" || especialidade.trim().length < 2)) {
      throw new AppError("Especialidade invalida!", 400);
    }

    if (
      telefone !== undefined &&
      (
        typeof telefone !== "string" ||
        !/^(\(?[0-9]{2}\)?) ?([0-9]{4,5})-?([0-9]{4})$/gm.test(telefone)
      )
    ) {
      throw new AppError("Telefone invalido!", 400);
    }

    if (role !== undefined && role !== "ADMIN" && role !== "TECNICO") {
      throw new AppError("Role invalido!", 400);
    }

    if (ativo !== undefined && typeof ativo !== "boolean") {
      throw new AppError("Ativo nao e valido!", 400);
    }

    const dadosParaAtualizar = {};

    if (nome !== undefined) dadosParaAtualizar.nome = nome;
    if (role !== undefined) dadosParaAtualizar.role = role;
    if (especialidade !== undefined) dadosParaAtualizar.especialidade = especialidade;
    if (telefone !== undefined) dadosParaAtualizar.telefone = telefone;
    if (ativo !== undefined) dadosParaAtualizar.ativo = ativo;

    if (Object.keys(dadosParaAtualizar).length === 0) {
      throw new AppError("Nenhum campo valido para atualizar!", 400);
    }

    return await UsuarioModel.update({ id: parseInt(id), dados: dadosParaAtualizar });
  }

  static async logoutAll(id) {
    const usuario = await UsuarioModel.findById(id);

    if (!usuario) {
      throw new AppError("Usuario nao encontrado!", 404);
    }

    await RefreshTokenModel.logoutAll(id);

    logger.info("auth_logout_all_succeeded", {
      usuarioId: usuario.id,
      role: usuario.role
    });

    return { mensagem: "usuario deslogado com sucesso!" };
  }

  static async delete(id) {
    const usuario = await UsuarioModel.findById(parseInt(id));

    if (!usuario) {
      throw new AppError("Usuario nao encontrado!", 404);
    }

    if (usuario.role === "ADMIN") {
      throw new AppError("Voce nao pode deletar outro admin!", 409);
    }

    await UsuarioModel.delete(parseInt(id));

    if (usuario.caminhoFoto) {
      try {
        await StorageService.deleteFoto({ bucket: "profile-images", caminho: usuario.caminhoFoto });
      } catch (error) {
        logger.error("usuario_delete_photo_cleanup_failed", {
          usuarioId: usuario.id,
          caminhoFoto: usuario.caminhoFoto,
          error
        });
      }
    }

    return { mensagem: "Usuario deletado com sucesso!" };
  }
}

module.exports = UsuarioService;
