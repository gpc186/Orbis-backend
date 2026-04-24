const { createClient } = require("@supabase/supabase-js");
const UsuarioModel = require("../models/usuarioModel");
const AppError = require("../utils/appErrorUtils");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE)

class storageService {
    static async uploadFotoPerfil(usuarioId, buffer, nomeArquivo){
        const usuario = await UsuarioModel.findById(usuarioId);
        
        if(!usuario){
            throw new AppError("Usuario não encontrado!", 404);
        };
        const caminhoImagem = `perfil/${usuario.id}/perfil-${Date.now()}.webp`;

        const { data, error } = await supabase.storage.from("profile-images").upload(caminhoImagem, buffer);

        if(error){
            throw new AppError("Erro ao tentar dar upload da imagem!", 500);
        };

        const { data: urlData } = supabase.storage.from("perfil-images").getPublicUrl(caminhoImagem);

        return { caminhoImagem, url: urlData.publicUrl };
    }
}