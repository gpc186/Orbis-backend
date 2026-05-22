const { createClient } = require("@supabase/supabase-js");
const AppError = require("../utils/appErrorUtils");

class StorageService {
  static imageBuckets = ["profile-images", "machine-images"];
  static documentBuckets = ["machine-manuals"];
  static client = null;

  static getClient() {
    if (!this.client) {
      this.client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);
    }

    return this.client;
  }

  static async uploadFoto({ bucket, caminho, buffer }) {
    if (!this.imageBuckets.includes(bucket)) {
      throw new AppError("Bucket de imagem invalido!", 400);
    }

    if (typeof caminho !== "string" || caminho.trim().length === 0) {
      throw new AppError("Caminho de imagem invalido!", 400);
    }

    if (!Buffer.isBuffer(buffer)) {
      throw new AppError("Buffer invalido!", 400);
    }

    const supabase = this.getClient();
    const { data, error } = await supabase.storage.from(bucket).upload(caminho, buffer, {
      contentType: "image/webp",
      cacheControl: "3600",
      upsert: true
    });

    if (error) {
      throw new AppError("Erro ao tentar dar upload da imagem!", 500);
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);

    return { caminhoImagem: data.path, url: urlData.publicUrl };
  }

  static async uploadArquivo({ bucket, caminho, buffer, contentType }) {
    if (!this.documentBuckets.includes(bucket)) {
      throw new AppError("Bucket de arquivo invalido!", 400);
    }

    if (typeof caminho !== "string" || caminho.trim().length === 0) {
      throw new AppError("Caminho de arquivo invalido!", 400);
    }

    if (!Buffer.isBuffer(buffer)) {
      throw new AppError("Buffer invalido!", 400);
    }

    const supabase = this.getClient();
    const { data, error } = await supabase.storage.from(bucket).upload(caminho, buffer, {
      contentType: contentType || "application/octet-stream",
      cacheControl: "3600",
      upsert: true
    });

    if (error) {
      throw new AppError("Erro ao tentar fazer upload do arquivo!", 500);
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);

    return { caminho: data.path, url: urlData.publicUrl };
  }

  static async deleteFoto({ bucket, caminho }) {
    if (!this.imageBuckets.includes(bucket)) {
      throw new AppError("Bucket de imagem invalido!", 400);
    }

    if (typeof caminho !== "string" || caminho.trim().length == 0) {
      throw new AppError("Caminho de imagem invalido!", 400);
    }

    const supabase = this.getClient();
    const { error } = await supabase.storage.from(bucket).remove([caminho]);

    if (error) {
      throw new AppError("Nao foi possivel deletar a imagem, por favor, tente novamente depois!", 500);
    }

    return { mensagem: "Foto deletada com sucesso!" };
  }

  static async deleteArquivo({ bucket, caminho }) {
    if (![...this.imageBuckets, ...this.documentBuckets].includes(bucket)) {
      throw new AppError("Bucket de arquivo invalido!", 400);
    }

    if (typeof caminho !== "string" || caminho.trim().length == 0) {
      throw new AppError("Caminho de arquivo invalido!", 400);
    }

    const supabase = this.getClient();
    const { error } = await supabase.storage.from(bucket).remove([caminho]);

    if (error) {
      throw new AppError("Nao foi possivel deletar o arquivo, por favor, tente novamente depois!", 500);
    }

    return { mensagem: "Arquivo deletado com sucesso!" };
  }
}

module.exports = StorageService;
