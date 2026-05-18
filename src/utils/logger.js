function normalizeError(error) {
  if (!(error instanceof Error)) {
    return error;
  }

  return {
    name: error.name,
    message: error.message,
    stack: error.stack
  };
}

function normalizeValue(value, seen = new WeakSet()) {
  if (value instanceof Error) {
    return normalizeError(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item, seen));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  if (seen.has(value)) {
    return "[Circular]";
  }

  seen.add(value);

  const normalized = {};

  for (const [key, item] of Object.entries(value)) {
    normalized[key] = normalizeValue(item, seen);
  }

  seen.delete(value);
  return normalized;
}

function write(level, message, context) {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString()
  };

  if (context !== undefined) {
    payload.context = normalizeValue(context);
  }

  const serialized = JSON.stringify(payload);

  if (level === "error") {
    console.error(serialized);
    return;
  }

  if (level === "warn") {
    console.warn(serialized);
    return;
  }

  console.log(serialized);
}

module.exports = {
  info(message, context) {
    write("info", message, context);
  },

  warn(message, context) {
    write("warn", message, context);
  },

  error(message, context) {
    write("error", message, context);
  }
};
