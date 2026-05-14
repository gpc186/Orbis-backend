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
  const nomeSan = cleanText(nome);
  const emailSan = cleanText(email).toLowerCase();
  const assuntoSan = cleanText(assunto);
  const mensagemSan = String(mensagem || "").trim();

  if (nomeSan.length < 2 || nomeSan.length > 80) throw new AppError("Nome inválido.", 400);
  if (!isValidEmail(emailSan) || emailSan.length > 120) throw new AppError("Email inválido.", 400);
  if (assuntoSan.length < 3 || assuntoSan.length > 140) throw new AppError("Assunto inválido.", 400);
  if (mensagemSan.length < 10 || mensagemSan.length > 3000) throw new AppError("Mensagem inválida.", 400);

  if (/[\r\n]/.test(emailSan) || /[\r\n]/.test(assuntoSan)) {
    throw new AppError("Dados inválidos.", 400);
  }

  return {
    nome: nomeSan,
    email: emailSan,
    assunto: assuntoSan,
    mensagem: mensagemSan
  };
}

function validateRelatorioPayload({ emailsDestino, assunto, htmlRelatorio }) {
  const to = normalizeEmails(emailsDestino);
  const subject = cleanText(assunto);
  const html = String(htmlRelatorio || "").trim();

  if (to.length === 0) throw new AppError("Informe ao menos um email de destino.", 400);
  if (to.length > 10) throw new AppError("Máximo de 10 destinatários por envio.", 400);

  const invalid = to.find((email) => !isValidEmail(email));
  if (invalid) throw new AppError(`Email inválido: ${invalid}`, 400);

  if (subject.length < 3 || subject.length > 140) throw new AppError("Assunto inválido.", 400);
  if (html.length < 20) throw new AppError("HTML do relatório inválido.", 400);
  if (html.length > 350_000) throw new AppError("HTML do relatório muito grande.", 400);

  return { to, subject, html };
}

module.exports = {
  validateContatoPayload,
  validateRelatorioPayload,
  normalizeEmails,
  isValidEmail,
  cleanText
};