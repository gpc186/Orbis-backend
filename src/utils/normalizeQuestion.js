function normalizeQuestion(input, maxLen = 500) {
  const original = typeof input === "string" ? input : "";

  let normalized = original.trim();

  normalized = normalized.replace(/[ \t]+/g, " ");

  normalized = normalized.replace(/\n{3,}/g, "\n\n");

  normalized = normalized.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "");

  if (normalized.length > maxLen) {
    normalized = normalized.slice(0, maxLen).trim();
  }

  return {
    original,
    normalized
  };
}

module.exports = normalizeQuestion