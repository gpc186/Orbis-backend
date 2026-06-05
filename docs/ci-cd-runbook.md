# CI/CD Runbook

Guia curto para validar o pipeline do Orbis antes de mergear ou publicar alteracoes.

## Validacao Local

Rode antes de abrir PR ou fazer push para `main`:

```bash
npm run ci:local
```

Esse comando executa:

- `npx prisma validate`
- `npm run test:ci`
- `npm run test:integration`

Observacao: `test:integration` so executa contra banco real quando `NODE_ENV=TEST` e `DATABASE_URL` aponta para banco seguro/de teste. Fora disso, ele pula com mensagem explicita.

## Validacao No GitHub Actions

O workflow fica em `.github/workflows/ci-cd.yml` e roda em:

- Pull request para `main`
- Push para `main`
- Disparo manual por `workflow_dispatch`

O job `Tests` valida:

- `npm ci`
- `npx prisma generate`
- Postgres descartavel com `postgres:16`
- `npx prisma db push --skip-generate`
- `npm run test:ci`
- `npm run test:integration`

## Estado Da Evidencia Remota

Nesta preparacao local, o commit remoto `origin/main` ainda nao contem o workflow novo e nao ha status/check registrado para essa leva de alteracoes.

Para produzir a evidencia final:

1. Commitar esta leva de testes/CI.
2. Fazer push para uma branch e abrir PR contra `main`, ou fazer push para `main` quando aprovado pelo time.
3. Confirmar no GitHub Actions que o job `Tests` passou.
4. Se for push para `main`, confirmar tambem o job `Deploy Render` e o smoke test quando `SMOKE_BASE_URL` estiver configurado.

## Deploy Render

No push para `main`, apos os testes, o job `Deploy Render` tenta disparar o deploy hook.

Secrets opcionais:

- `RENDER_DEPLOY_HOOK_URL`: URL do deploy hook do Render.
- `SMOKE_BASE_URL`: URL publicada da API para smoke test pos-deploy.

Se `RENDER_DEPLOY_HOOK_URL` nao estiver configurado, o deploy e pulado sem falhar o workflow.

Se `SMOKE_BASE_URL` estiver configurado, o workflow aguarda brevemente e roda:

```bash
npm run smoke:health
```

Esse smoke valida:

- `GET /health` com `{ ok: true }`
- `GET /ready` com `{ ok: true }`

## Criterio Para Considerar Verde

- Job `Tests` concluido com sucesso.
- Job `Deploy Render` concluido com sucesso ou explicitamente pulado por falta de secret.
- Se `SMOKE_BASE_URL` estiver configurado, smoke test pos-deploy concluido com sucesso.
