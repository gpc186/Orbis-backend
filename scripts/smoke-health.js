const baseUrlInput = process.argv[2] || process.env.SMOKE_BASE_URL;
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 10_000);

function normalizeBaseUrl(value) {
  if (!value) {
    throw new Error("Informe SMOKE_BASE_URL ou passe a URL base como argumento.");
  }

  const url = new URL(value);
  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";

  return url.toString().replace(/\/$/, "");
}

async function fetchJsonWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    const text = await response.text();
    const json = text ? JSON.parse(text) : null;

    return { response, json };
  } finally {
    clearTimeout(timeout);
  }
}

async function assertEndpoint(baseUrl, path) {
  const url = `${baseUrl}${path}`;
  const { response, json } = await fetchJsonWithTimeout(url);

  if (response.status !== 200) {
    throw new Error(`${path} retornou status ${response.status}.`);
  }

  if (!json || json.ok !== true) {
    throw new Error(`${path} nao retornou { ok: true }.`);
  }

  console.log(`smoke_ok ${path}`);
}

async function main() {
  const baseUrl = normalizeBaseUrl(baseUrlInput);

  await assertEndpoint(baseUrl, "/health");
  await assertEndpoint(baseUrl, "/ready");

  console.log(`smoke_finished ${baseUrl}`);
}

main().catch((error) => {
  console.error(`smoke_failed ${error.message}`);
  process.exitCode = 1;
});
