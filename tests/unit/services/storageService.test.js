const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");

const StorageService = require("../../../src/services/storageService");

const originalClient = StorageService.client;

function assertAppError(statusCode) {
  return (error) => error.name === "AppError" && error.statusCode === statusCode;
}

function createFakeSupabase({ uploadResult, uploadError, removeError } = {}) {
  const calls = [];
  const client = {
    storage: {
      from(bucket) {
        calls.push(["from", bucket]);
        return {
          async upload(caminho, buffer, options) {
            calls.push(["upload", caminho, buffer, options]);
            return uploadError
              ? { data: null, error: uploadError }
              : { data: uploadResult || { path: caminho }, error: null };
          },
          getPublicUrl(path) {
            calls.push(["getPublicUrl", path]);
            return { data: { publicUrl: `https://cdn.example.com/${path}` } };
          },
          async remove(paths) {
            calls.push(["remove", paths]);
            return { error: removeError || null };
          }
        };
      }
    }
  };

  return { client, calls };
}

afterEach(() => {
  StorageService.client = originalClient;
});

test("uploadFoto valida bucket, caminho, buffer e retorna URL publica", async () => {
  const { client, calls } = createFakeSupabase();
  StorageService.client = client;
  const buffer = Buffer.from("imagem");

  const result = await StorageService.uploadFoto({
    bucket: "profile-images",
    caminho: "perfil/1/foto.webp",
    buffer
  });

  assert.deepEqual(result, {
    caminhoImagem: "perfil/1/foto.webp",
    url: "https://cdn.example.com/perfil/1/foto.webp"
  });
  assert.deepEqual(calls, [
    ["from", "profile-images"],
    ["upload", "perfil/1/foto.webp", buffer, { contentType: "image/webp", cacheControl: "3600", upsert: true }],
    ["from", "profile-images"],
    ["getPublicUrl", "perfil/1/foto.webp"]
  ]);

  await assert.rejects(
    () => StorageService.uploadFoto({ bucket: "invalid", caminho: "foto.webp", buffer }),
    assertAppError(400)
  );
  await assert.rejects(
    () => StorageService.uploadFoto({ bucket: "profile-images", caminho: "", buffer }),
    assertAppError(400)
  );
  await assert.rejects(
    () => StorageService.uploadFoto({ bucket: "profile-images", caminho: "foto.webp", buffer: "x" }),
    assertAppError(400)
  );
});

test("uploadArquivo usa bucket de documento, contentType padrao e trata erro do provider", async () => {
  const buffer = Buffer.from("manual");
  const { client, calls } = createFakeSupabase();
  StorageService.client = client;

  const result = await StorageService.uploadArquivo({
    bucket: "machine-manuals",
    caminho: "manuals/1/manual.pdf",
    buffer
  });

  assert.deepEqual(result, {
    caminho: "manuals/1/manual.pdf",
    url: "https://cdn.example.com/manuals/1/manual.pdf"
  });
  assert.deepEqual(calls[1], [
    "upload",
    "manuals/1/manual.pdf",
    buffer,
    { contentType: "application/octet-stream", cacheControl: "3600", upsert: true }
  ]);

  const failing = createFakeSupabase({ uploadError: { statusCode: 500, message: "falhou" } });
  StorageService.client = failing.client;

  await assert.rejects(
    () => StorageService.uploadArquivo({ bucket: "machine-manuals", caminho: "manual.pdf", buffer }),
    assertAppError(500)
  );
});

test("deleteFoto e deleteArquivo removem caminho correto e validam entradas", async () => {
  const { client, calls } = createFakeSupabase();
  StorageService.client = client;

  assert.deepEqual(
    await StorageService.deleteFoto({ bucket: "machine-images", caminho: "maquinas/1/foto.webp" }),
    { mensagem: "Foto deletada com sucesso!" }
  );
  assert.deepEqual(
    await StorageService.deleteArquivo({ bucket: "machine-manuals", caminho: "manuals/1/manual.pdf" }),
    { mensagem: "Arquivo deletado com sucesso!" }
  );
  assert.deepEqual(calls, [
    ["from", "machine-images"],
    ["remove", ["maquinas/1/foto.webp"]],
    ["from", "machine-manuals"],
    ["remove", ["manuals/1/manual.pdf"]]
  ]);

  await assert.rejects(
    () => StorageService.deleteFoto({ bucket: "machine-manuals", caminho: "x" }),
    assertAppError(400)
  );
  await assert.rejects(
    () => StorageService.deleteArquivo({ bucket: "machine-manuals", caminho: " " }),
    assertAppError(400)
  );

  const failing = createFakeSupabase({ removeError: { status: 500 } });
  StorageService.client = failing.client;

  await assert.rejects(
    () => StorageService.deleteArquivo({ bucket: "machine-manuals", caminho: "manual.pdf" }),
    assertAppError(500)
  );
});
