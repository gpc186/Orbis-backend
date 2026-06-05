const { test } = require("node:test");
const assert = require("node:assert/strict");
const sharp = require("sharp");

const {
  imagemProcessada,
  _test: {
    allowedMimeTypes,
    allowedManualMimeTypes,
    filtrarImagem,
    filtrarManual,
    processarImagem
  }
} = require("../../../src/middlewares/uploadMiddleware");

function runFilter(filter, file) {
  const calls = [];
  filter({}, file, (error, accepted) => {
    calls.push({ error, accepted });
  });
  return calls[0];
}

function captureNext() {
  const calls = [];
  const next = (error) => calls.push(error);
  next.calls = calls;
  return next;
}

test("filtros de upload aceitam mimes permitidos e bloqueiam tipos invalidos", () => {
  assert.deepEqual(allowedMimeTypes, ["image/png", "image/jpg", "image/jpeg", "image/webp"]);
  assert.deepEqual(allowedManualMimeTypes, ["application/pdf"]);

  assert.deepEqual(runFilter(filtrarImagem, { mimetype: "image/png" }), {
    error: null,
    accepted: true
  });
  assert.deepEqual(runFilter(filtrarManual, { mimetype: "application/pdf" }), {
    error: null,
    accepted: true
  });

  const imagemInvalida = runFilter(filtrarImagem, { mimetype: "text/plain" });
  assert.equal(imagemInvalida.accepted, false);
  assert.equal(imagemInvalida.error.name, "AppError");
  assert.equal(imagemInvalida.error.statusCode, 400);

  const manualInvalido = runFilter(filtrarManual, { mimetype: "application/json" });
  assert.equal(manualInvalido.accepted, false);
  assert.equal(manualInvalido.error.name, "AppError");
  assert.equal(manualInvalido.error.statusCode, 400);
});

test("processarImagem redimensiona sem ampliar e converte para webp", async () => {
  const original = await sharp({
    create: {
      width: 20,
      height: 10,
      channels: 3,
      background: { r: 255, g: 0, b: 0 }
    }
  }).png().toBuffer();

  const output = await processarImagem(original);
  const metadata = await sharp(output).metadata();

  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 20);
  assert.equal(metadata.height, 10);
});

test("imagemProcessada atualiza buffer e mimetype para imagem valida", async () => {
  const original = await sharp({
    create: {
      width: 700,
      height: 400,
      channels: 3,
      background: { r: 0, g: 0, b: 255 }
    }
  }).jpeg().toBuffer();
  const req = {
    file: {
      buffer: original,
      mimetype: "image/jpeg"
    }
  };
  const next = captureNext();

  await imagemProcessada(req, {}, next);

  const metadata = await sharp(req.file.buffer).metadata();
  assert.deepEqual(next.calls, [undefined]);
  assert.equal(req.file.mimetype, "image/webp");
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 600);
  assert.equal(metadata.height, 343);
});

test("imagemProcessada retorna AppError quando arquivo esta ausente ou buffer invalido", async () => {
  const semArquivoNext = captureNext();
  await imagemProcessada({}, {}, semArquivoNext);

  assert.equal(semArquivoNext.calls[0].name, "AppError");
  assert.equal(semArquivoNext.calls[0].statusCode, 400);

  const invalidoNext = captureNext();
  await imagemProcessada({ file: { buffer: Buffer.from("nao-imagem") } }, {}, invalidoNext);

  assert.equal(invalidoNext.calls[0].name, "AppError");
  assert.equal(invalidoNext.calls[0].statusCode, 400);
});
