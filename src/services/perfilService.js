const UsuarioModel = require("../models/usuarioModel");
const AppError = require("../utils/appErrorUtils")

class PerfilService {
    static async findPerfil(id) {
        const usuario = await UsuarioModel.findById(id);

        if (!usuario) {
            throw new AppError("Perfil não encontrado!", 404);
        }

        return usuario;
    }

    static async updatePerfil({ id, dados }) {
        const { nome, telefone, especialidade } = dados
        const usuario = await UsuarioModel.findById(id);
        if (!usuario) {
            throw new AppError("Perfil não encontrado!", 404);
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

        if (dados.nome !== undefined) dadosParaAtualizar.nome = nome;
        if (dados.telefone !== undefined) dadosParaAtualizar.telefone = telefone;
        if (dados.especialidade !== undefined) dadosParaAtualizar.especialidade = especialidade;

        if (Object.keys(dadosParaAtualizar).length === 0) {
            throw new AppError("Nenhum campo válido para atualizar!", 400);
        }

        const contaAtualizada = await UsuarioModel.update({id, dados: dadosParaAtualizar});

        return contaAtualizada;
    }

    static async putOneSignalId({ id, oneSignalId }) {
        const usuario = await UsuarioModel.findById(id);
        if (!usuario) {
            throw new AppError("Perfil não encontrado!", 404);
        };

        if (usuario.oneSignalId) {
            throw new AppError("one signal id já colocado no perfil!", 409);
        };

        const contaAtualizada = await UsuarioModel.update({ id, dados: oneSignalId });
        return contaAtualizada;
    };
};

module.exports = PerfilService;