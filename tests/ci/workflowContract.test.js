const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const workflowPath = path.resolve(__dirname, "../../.github/workflows/ci-cd.yml");

function readWorkflow() {
  return fs.readFileSync(workflowPath, "utf8");
}

test("workflow CI/CD preserva gatilhos principais", () => {
  const workflow = readWorkflow();

  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /push:/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /branches:\s*\n\s*-\s*main/);
});

test("workflow CI/CD prepara Postgres descartavel e schema Prisma", () => {
  const workflow = readWorkflow();

  assert.match(workflow, /services:\s*\n\s*postgres:/);
  assert.match(workflow, /image:\s*postgres:16/);
  assert.match(workflow, /POSTGRES_DB:\s*orbis_test/);
  assert.match(workflow, /DATABASE_URL:\s*postgresql:\/\/orbis:orbis@localhost:5432\/orbis_test/);
  assert.match(workflow, /npx prisma generate/);
  assert.match(workflow, /npx prisma db push --skip-generate/);
});

test("workflow CI/CD roda suites unitarias, cobertura e integracao", () => {
  const workflow = readWorkflow();

  assert.match(workflow, /npm run test:ci/);
  assert.match(workflow, /npm run test:integration/);
  assert.match(workflow, /NODE_ENV:\s*TEST/);
});

test("workflow CI/CD preserva deploy hook e smoke test opcionais", () => {
  const workflow = readWorkflow();

  assert.match(workflow, /RENDER_DEPLOY_HOOK_URL/);
  assert.match(workflow, /curl --fail --request POST "\$RENDER_DEPLOY_HOOK_URL"/);
  assert.match(workflow, /SMOKE_BASE_URL/);
  assert.match(workflow, /npm run smoke:health/);
});
