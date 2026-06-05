const AppError = require("./appErrorUtils");

function cleanText(v = "") {
  return String(v)
    .trim()
    .replace(/[ \t]+/g, " ")
    .replace(/[\u0000-\u001F\u007F]/g, "");
}

function isValidEmail(email = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).toLowerCase());
}

function normalizeEmails(input) {
  const arr = Array.isArray(input) ? input : [input];
  return [...new Set(arr.map((e) => cleanText(e).toLowerCase()).filter(Boolean))];
}

function validateContatoPayload({ nome, email, assunto, mensagem }) {
  const rawEmail = String(email ?? "");
  const rawAssunto = String(assunto ?? "");
  const nomeSan = cleanText(nome);
  const emailSan = cleanText(rawEmail).toLowerCase();
  const assuntoSan = cleanText(rawAssunto);
  const mensagemSan = String(mensagem || "").trim();

  if (nomeSan.length < 2 || nomeSan.length > 80) throw new AppError("Nome invalido.", 400);
  if (!isValidEmail(emailSan) || emailSan.length > 120) throw new AppError("Email invalido.", 400);
  if (assuntoSan.length < 3 || assuntoSan.length > 140) throw new AppError("Assunto invalido.", 400);
  if (mensagemSan.length < 10 || mensagemSan.length > 3000) throw new AppError("Mensagem invalida.", 400);

  if (/[\r\n]/.test(rawEmail) || /[\r\n]/.test(rawAssunto)) {
    throw new AppError("Dados invalidos.", 400);
  }

  return {
    nome: nomeSan,
    email: emailSan,
    assunto: assuntoSan,
    mensagem: mensagemSan
  };
}

module.exports = {
  validateContatoPayload,
  normalizeEmails,
  isValidEmail,
  cleanText
};
