function cleanText(v = "") {
  return String(v)
    .trim()
    .replace(/[ \t]+/g, " ")
    .replace(/[\u0000-\u001F\u007F]/g, "");
}

function validateContactPayload(body = {}) {
  const nome = cleanText(body.nome);
  const email = cleanText(body.email).toLowerCase();
  const assunto = cleanText(body.assunto);
  const mensagem = cleanText(body.mensagem);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (nome.length < 2 || nome.length > 80) {
    return { ok: false, status: 400, message: "Nome inválido." };
  }

  if (!emailRegex.test(email) || email.length > 120) {
    return { ok: false, status: 400, message: "Email inválido." };
  }

  if (/[\r\n]/.test(email) || /[\r\n]/.test(assunto)) {
    return { ok: false, status: 400, message: "Dados inválidos." };
  }

  if (assunto.length < 3 || assunto.length > 120) {
    return { ok: false, status: 400, message: "Assunto inválido." };
  }

  if (mensagem.length < 10 || mensagem.length > 2000) {
    return { ok: false, status: 400, message: "Mensagem inválida." };
  }

  return { ok: true, data: { nome, email, assunto, mensagem } };
}

module.exports = { validateContactPayload };