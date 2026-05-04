const { createClient } = require("@supabase/supabase-js");
const AppError = require("../utils/appErrorUtils");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE)

class StorageService {

    static async uploadFoto({ bucket, caminho, buffer }) {
        if (bucket !== "profile-images" && bucket !== "machine-images") {
            throw new AppError("Bucket de imagem inválido!", 400);
        }

        if (typeof caminho !== "string" || caminho.trim().length === 0) {
            throw new AppError("Caminho de imagem inválido!", 400);
        }

        if (!Buffer.isBuffer(buffer)) {
            throw new AppError("Buffer inválido!", 400);
        }

        const { data, error } = await supabase.storage.from(bucket).upload(caminho, buffer, {
            contentType: "image/webp",
            cacheControl: "3600",
            upsert: false
        });

        if (error) {
            throw new AppError("Erro ao tentar dar upload da imagem!", 500);
        }

        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);

        return { caminhoImagem: data.path, url: urlData.publicUrl };
    }

    static async deleteFoto({ bucket, caminho }) {
        if (bucket !== "profile-images" && bucket !== "machine-images") {
            throw new AppError("Bucket de imagem inválido!", 400);
        };

        if (typeof caminho !== "string" || caminho.trim().length == 0) {
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