const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcrypt");

const ResetSenhaService = require("../../../src/services/resetSenhaService");
const EmailService = require("../../../src/services/emailService");
const ResetSenhaModel = require("../../../src/models/resetSenhaModel");
const UsuarioModel = require("../../../src/models/usuarioModel");

const originals = {
  random: Math.random,
  findByEmail: UsuarioModel.findByEmail,
  findByIdWithSenha: UsuarioModel.findByIdWithSenha,
  updateSenha: UsuarioModel.updateSenha,
  upsert: ResetSenhaModel.upsert,
  findByUsuarioId: ResetSenhaModel.findByUsuarioId,
  deleteByUsuarioId: ResetSenhaModel.deleteByUsuarioId,
  send: EmailService.send,
  hash: bcrypt.hash,
  compare: bcrypt.compare
};

afterEach(() => {
  Math.random = originals.random;
  UsuarioModel.findByEmail = originals.findByEmail;
  UsuarioModel.findByIdWithSenha = originals.findByIdWithSenha;
  UsuarioModel.updateSenha = originals.updateSenha;
  ResetSenhaModel.upsert = originals.upsert;
  ResetSenhaModel.findByUsuarioId = originals.findByUsuarioId;
  ResetSenhaModel.deleteByUsuarioId = originals.deleteByUsuarioId;
  EmailService.send = originals.send;
  bcrypt.hash = originals.hash;
  bcrypt.compare = originals.compare;
});

function futureDate() {
  return new Date(Date.now() + 60_000);
}

function pastDate() {
  return new Date(Date.now() - 60_000);
}

function normalizeMessage(message) {
  return message.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

test("esqueceuSenha gera codigo, salva reset e envia email quando usuario existe", async () => {
  Math.random = () => 0.123456;
  UsuarioModel.findByEmail = async () => ({ id: 7, nome: "Gustavo", email: "user@example.com" });

  let upsertPayload;
  ResetSenhaModel.upsert = async (payload) => {
    upsertPayload = payload;
  };

  let emailPayload;
  EmailService.send = async (payload) => {
    emailPayload = payload;
    return { provider: "resend", messageId: "msg-1" };
  };

  const result = await ResetSenhaService.esqueceuSenha({
    email: "user@example.com",
    emailDestino: "destino@example.com"
  });

  assert.equal(normalizeMessage(result.message), "Se o usuario existir, o codigo sera enviado.");
  assert.equal(upsertPayload.usuarioId, 7);
  assert.equal(upsertPayload.code, "211110");
  assert.equal(upsertPayload.emailDestino, "destino@example.com");
  assert.ok(upsertPayload.expiresAt instanceof Date);
  assert.equal(emailPayload.to, "destino@example.com");
  assert.match(emailPayload.html, /211110/);
});

test("esqueceuSenha nao revela inexistencia de usuario e nao envia email", async () => {
  UsuarioModel.findByEmail = async () => null;

  let emailChamado = false;
  EmailService.send = async () => {
    emailChamado = true;
  };
  ResetSenhaModel.upsert = async () => {
    throw new Error("nao deveria salvar reset");
  };

  const result = await ResetSenhaService.esqueceuSenha({
    email: "inexistente@example.com",
    emailDestino: "destino@example.com"
  });

  assert.equal(normalizeMessage(result.message), "Se o usuario existir, o codigo sera enviado.");
  assert.equal(emailChamado, false);
});

test("esqueceuSenha valida dados obrigatorios e formato de email", async () => {
  await assert.rejects(
    () => ResetSenhaService.esqueceuSenha({ email: "", emailDestino: "destino@example.com" }),
    (error) => error.name === "AppError" && error.statusCode === 400
  );

  await assert.rejects(
    () => ResetSenhaService.esqueceuSenha({ email: "email-invalido", emailDestino: "destino@example.com" }),
    (error) => error.name === "AppError" && error.statusCode === 400
  );
});

test("validarCodigo aceita codigo valido e bloqueia invalido ou expirado", async () => {
  UsuarioModel.findByEmail = async () => ({ id: 7 });
  ResetSenhaModel.findByUsuarioId = async () => ({ code: "123456", expiresAt: futureDate() });

  const validacao = await ResetSenhaService.validarCodigo({
    email: "user@example.com",
    code: "123456"
  });

  assert.equal(normalizeMessage(validacao.message), "Codigo valido.");

  await assert.rejects(
    () => ResetSenhaService.validarCodigo({ email: "user@example.com", code: "000000" }),
    (error) => error.name === "AppError" && error.statusCode === 400
  );

  ResetSenhaModel.findByUsuarioId = async () => ({ code: "123456", expiresAt: pastDate() });

  await assert.rejects(
    () => ResetSenhaService.validarCodigo({ email: "user@example.com", code: "123456" }),
    (error) => error.name === "AppError" && error.statusCode === 400
  );
});

test("redefinirSenha atualiza hash e remove codigo usado", async () => {
  UsuarioModel.findByEmail = async () => ({ id: 7 });
  ResetSenhaModel.findByUsuarioId = async () => ({ code: "123456", expiresAt: futureDate() });
  bcrypt.hash = async (senha, rounds) => `hash:${senha}:${rounds}`;

  let updatePayload;
  UsuarioModel.updateSenha = async (id, senhaHash) => {
    updatePayload = { id, senhaHash };
  };

  let deletedUserId;
  ResetSenhaModel.deleteByUsuarioId = async (id) => {
    deletedUserId = id;
  };

  const result = await ResetSenhaService.redefinirSenha({
    email: "user@example.com",
    code: "123456",
    novaSenha: "nova-senha"
  });

  assert.deepEqual(result, { message: "Senha redefinida com sucesso." });
  assert.deepEqual(updatePayload, {
    id: 7,
    senhaHash: "hash:nova-senha:10"
  });
  assert.equal(deletedUserId, 7);
});

test("solicitarAlteracao valida senha atual, salva codigo e envia email", async () => {
  Math.random = () => 0.5;
  UsuarioModel.findByIdWithSenha = async () => ({
    id: 8,
    nome: "Tecnico",
    senha: "hash-antigo"
  });
  bcrypt.compare = async (plain, hash) => plain === "senha-atual" && hash === "hash-antigo";

  let upsertPayload;
  ResetSenhaModel.upsert = async (payload) => {
    upsertPayload = payload;
  };

  let emailPayload;
  EmailService.send = async (payload) => {
    emailPayload = payload;
  };

  const result = await ResetSenhaService.solicitarAlteracao({
    id: 8,
    senhaAtual: "senha-atual",
    emailDestino: "destino@example.com"
  });

  assert.equal(normalizeMessage(result.message), "Codigo enviado para o email informado.");
  assert.equal(upsertPayload.usuarioId, 8);
  assert.equal(upsertPayload.code, "550000");
  assert.equal(emailPayload.to, "destino@example.com");
  assert.match(emailPayload.html, /550000/);
});

test("solicitarAlteracao bloqueia usuario inexistente ou senha atual incorreta", async () => {
  UsuarioModel.findByIdWithSenha = async () => null;

  await assert.rejects(
    () => ResetSenhaService.solicitarAlteracao({
      id: 8,
      senhaAtual: "senha",
      emailDestino: "destino@example.com"
    }),
    (error) => error.name === "AppError" && error.statusCode === 404
  );

  UsuarioModel.findByIdWithSenha = async () => ({ id: 8, senha: "hash" });
  bcrypt.compare = async () => false;

  await assert.rejects(
    () => ResetSenhaService.solicitarAlteracao({
      id: 8,
      senhaAtual: "errada",
      emailDestino: "destino@example.com"
    }),
    (error) => error.name === "AppError" && error.statusCode === 400
  );
});

test("confirmarAlteracao troca senha quando codigo e valido e senha e diferente", async () => {
  UsuarioModel.findByIdWithSenha = async () => ({ id: 8, senha: "hash-antigo" });
  ResetSenhaModel.findByUsuarioId = async () => ({ code: "123456", expiresAt: futureDate() });
  bcrypt.compare = async (plain) => plain === "senha-antiga";
  bcrypt.hash = async (senha, rounds) => `hash:${senha}:${rounds}`;

  let updatePayload;
  UsuarioModel.updateSenha = async (id, senhaHash) => {
    updatePayload = { id, senhaHash };
  };

  let deletedUserId;
  ResetSenhaModel.deleteByUsuarioId = async (id) => {
    deletedUserId = id;
  };

  const result = await ResetSenhaService.confirmarAlteracao({
    id: 8,
    code: "123456",
    novaSenha: "senha-nova"
  });

  assert.deepEqual(result, { message: "Senha alterada com sucesso." });
  assert.deepEqual(updatePayload, {
    id: 8,
    senhaHash: "hash:senha-nova:10"
  });
  assert.equal(deletedUserId, 8);
});

test("confirmarAlteracao bloqueia codigo expirado e senha igual a atual", async () => {
  UsuarioModel.findByIdWithSenha = async () => ({ id: 8, senha: "hash-antigo" });
  ResetSenhaModel.findByUsuarioId = async () => ({ code: "123456", expiresAt: pastDate() });

  await assert.rejects(
    () => ResetSenhaService.confirmarAlteracao({
      id: 8,
      code: "123456",
      novaSenha: "senha-nova"
    }),
    (error) => error.name === "AppError" && error.statusCode === 400
  );

  ResetSenhaModel.findByUsuarioId = async () => ({ code: "123456", expiresAt: futureDate() });
  bcrypt.compare = async () => true;

  await assert.rejects(
    () => ResetSenhaService.confirmarAlteracao({
      id: 8,
      code: "123456",
      novaSenha: "senha-antiga"
    }),
    (error) => error.name === "AppError" && error.statusCode === 400
  );
});
