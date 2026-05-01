const { createClient } = require("@supabase/supabase-js");
const UsuarioModel = require("../models/usuarioModel");
const AppError = require("../utils/appErrorUtils");
const MaquinaModel = require("../models/maquinaModel");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE)

class StorageService {
    static async uploadFotoPerfil({ usuarioId, buffer }) {
        const usuario = await UsuarioModel.findById(usuarioId);

        if (!usuario) {
            throw new AppError("Usuario não encontrado!", 404);
        };

        const caminhoImagem = `perfil/${usuario.id}/perfil-${Date.now()}.webp`;

        const { data, error } = await supabase.storage.from("profile-images").upload(caminhoImagem, buffer);

        if (error) {
            throw new AppError("Erro ao tentar dar upload da imagem!", 500);
        };

        const { data: urlData } = supabase.storage.from("profile-images").getPublicUrl(data.path);

        return { caminhoImagem: data.path, url: urlData.publicUrl };
    };

    static async uploadFotoMaquina({ maquinaId, buffer }) {
        const maquina = await MaquinaModel.findById(maquinaId);

        if (!maquina || maquina.ativo == false) {
            throw new AppError("Maquina não foi encontrada!", 404);
        };

        const caminhoImagem = `maquina/${maquinaId}/maquina-${Date.now()}.webp`;

        const { data, error } = await supabase.storage.from("machine-images").upload(caminhoImagem, buffer);

        if (error) {
            throw new AppError("Erro ao tentar dar upload da imagem!", 500);
        };

        const { data: urlData } = supabase.storage.from("machine-images").getPublicUrl(data.path);

        return { caminhoImagem: data.path, url: urlData.publicUrl };
    };

    static async deleteFoto({ bucket, caminho }) {
        if (bucket !== "profile-images" && bucket !== "machine-images") {
            throw new AppError("Bucket de imagem inválido!", 400);
        };

        if ( typeof caminho !== "string" || caminho.trim().length == 0) {
            throw new AppError("Caminho de imagem inválido!", 400);
        };

        const { data, error } = await supabase.storage.from(bucket).remove([caminho]);

        if (error) {
            throw new AppError("Não foi possivel deletar a imagem, por favor, tente novamente depois!", 500);
        };

        return { mensagem: "Foto deletada com sucesso!" };
    };
}

module.exports = StorageService