# Testing and CI/CD Roadmap

Este documento registra o plano vivo para fortalecer testes e pipeline do Orbis sem adicionar funcionalidades novas fora desse objetivo.

## Estado Atual

- `npm test` roda testes de controllers, middlewares, rotas, services, aiTools e templates.
- `npm run test:coverage` roda a mesma suite com cobertura nativa do Node.
- `npm run test:ci` roda a suite normal e a suite com cobertura, espelhando o comando usado no GitHub Actions.
- `npm run test:integration` roda uma suite separada contra banco real; por seguranca, ela executa apenas com `NODE_ENV=TEST` e `DATABASE_URL` segura/de teste.
- `npm run smoke:health` valida `/health` e `/ready` contra uma URL publicada usando `SMOKE_BASE_URL` ou argumento CLI.
- `npm run ci:local` valida schema Prisma, suite principal, cobertura e integracao segura antes de push/PR.
- Os testes ficam centralizados em `tests/`: `tests/unit` espelha as areas de `src`, `tests/integration` concentra cenarios Prisma/banco real e `tests/ci` valida contratos do workflow.
- A suite local validada nesta etapa passou com 311 testes.
- A execucao com cobertura nativa do Node tambem passou e indicou cobertura geral aproximada de 83.56% em linhas.
- O workflow `.github/workflows/ci-cd.yml` executa CI em pull requests para `main`, push para `main` e tambem pode ser disparado manualmente por `workflow_dispatch`.
- O workflow sobe um Postgres descartavel, aplica `npx prisma db push --skip-generate` e roda `npm run test:integration` apos `npm run test:ci`.
- O mesmo workflow possui deploy opcional para Render em push para `main`, usando o secret `RENDER_DEPLOY_HOOK_URL`.
- Quando `SMOKE_BASE_URL` esta configurado, o workflow roda smoke test pos-deploy para `/health` e `/ready`.
- O runbook `docs/ci-cd-runbook.md` documenta validacao local, validacao no GitHub Actions, secrets opcionais e criterio de aceite.

## Cobertura Ja Forte

- Predicao linear e fallback heuristico.
- Risco preditivo.
- Alerta preditivo.
- Feature engineering.
- Dashboard IA, confirmacao e desambiguacao.
- Tools de IA de leitura e escrita.
- Agendamentos de relatorio.
- Template de relatorio.
- Validacoes novas de sensores.
- Alteracao do proprio status ativo em usuario.
- Middlewares de auth, role e ESP32 API key.
- Readiness de infraestrutura.
- Agregados principais do dashboard.
- Regras centrais de criacao/atualizacao de manutencao.
- Leitura de sensores, geracao de alertas e tolerancia a falha da predicao.
- Alertas ativos, notificacao push, consultas por maquina e eventos.
- Fluxos principais de maquina: formatacao, upload de foto, manual, sanitizacao e predicoes.
- Execucao manual/agendada de relatorios, incluindo sucesso, falha e snapshots.
- Reset/troca de senha, incluindo codigo, expiracao, senha atual e limpeza do reset usado.
- Controllers de auth e reset de senha, incluindo payloads, usuario autenticado e `next(error)`.
- Controllers pequenos de dashboard, dashboard IA e contato por email.
- Controllers operacionais de alertas, manutencoes, leituras e historico de integridade.
- Controllers de usuarios, tecnicos, perfil e sensores, incluindo caminhos felizes, validacoes e `next(error)`.
- Controllers de relatorios e agendamentos, incluindo envio manual, preview, CRUD, status, execucao manual e listagem de execucoes.
- `historicoIntegridadeService`, incluindo normalizacao de limite, percentuais, datas, filtros, criacao e erros 404.
- `perfilService`, incluindo validacoes de perfil, OneSignalId, upload de foto, limpeza de storage e push de teste.
- `reportPresenter` e `relatorioDataService`, incluindo shape publico, datas, descricao de agendamento e coleta seletiva por secoes.
- `emailService`, `oneSignalService` e `storageService`, incluindo validacoes, payloads para provider, tratamento de erro e mocks sem rede.
- `groqService` e `embeddingService`, incluindo config, validacoes, tool calls, texto, embeddings Groq/Gemini, batching e erros de provider.
- `maquinaManualService`, incluindo chunking, selecao semantica/por keywords, embeddings medios, preview, build de dados, upload, JSON da IA e nomes seguros.
- `mqttService`, incluindo conexao, assinatura de topico, leitura valida, fallback de `MQTT_SENSOR_ID`, forwarding via websocket e logs de erro.
- `uploadMiddleware`, incluindo filtros de MIME para imagem/manual, processamento WebP com `sharp`, arquivo ausente e buffer invalido.
- `usuarioService`, incluindo login, registro, refresh, logout/logoutAll, buscas, paginacao, tecnicos, update, updateAtivo e delete com cleanup tolerante a falha.
- `relatorioAgendamentoService`, incluindo preview, create, list, find, busca por destinatario, update, status, delete, execucao manual e processamento de agendamentos vencidos.
- `sensorService`, incluindo parsing numerico, relacoes de limites, create/list/find, buscas por tipo/maquina, update, disconnect, delete, contagem de ativos e sensores offline.
- `relatorioRendererService` e `reportTemplate`, incluindo escopo, assunto/fallback, renderizacao HTML, escape de dados dinamicos, estados vazios e classificacao por integridade.
- Contratos HTTP principais em `tests/unit/routes`, cobrindo health/readiness, login, rota protegida sem token, role admin, sensores autenticados, `PUT /usuarios/alterar-ativo`, perfil, upload multipart de foto, maquinas, preview multipart de manual, predicao, historico por maquina, leituras ESP32 com `x-api-key`, alertas, manutencoes, dashboard resumo, reset/troca de senha, preview/execucoes de relatorios, IA autenticada e contato publico.
- Jobs agendados, incluindo limpeza de leituras antigas, relatorios vencidos, sensores offline, tendencia em producao e protecao contra execucao de tendencia fora de producao.
- Models Prisma centrais com queries mockadas, incluindo transacoes de maquina/alerta, normalizacao de sensor, filtros de usuario, agendamentos de relatorio vencidos/locks e filtros de alertas por periodo.
- Utilitarios compartilhados, incluindo validacao de contato/email, JWT/refresh token, normalizacao de pergunta, agendamento de relatorios em timezone fixo, validacao de payloads de relatorio e variaveis obrigatorias de ambiente.
- Hardening de contato/email contra CRLF em campos usados por cabecalho, validando o valor cru antes da normalizacao.
- Integracao Prisma com banco real para fluxo principal de persistencia, cobrindo usuario, maquina, historico inicial, sensor, alerta/evento e agendamento de relatorio com lock/sucesso.
- Smoke test operacional para API publicada, cobrindo `/health` e `/ready` apos deploy quando `SMOKE_BASE_URL` estiver configurado.
- Contrato local do workflow CI/CD, garantindo gatilhos, Postgres descartavel, Prisma, `test:ci`, `test:integration`, deploy hook e smoke opcional no YAML.

## Lacunas Prioritarias

### Alta Prioridade

- Expandir testes de contrato/integracao para rotas publicas consumidas pelo frontend que ainda nao entraram na primeira leva, com foco em CRUDs menos criticos, variacoes negativas de multipart e smoke tests reais com banco.
- Validacao do workflow em ambiente GitHub Actions real apos push/PR ou disparo manual, incluindo `npm ci`, `npx prisma generate`, Postgres descartavel, `npm run test:ci`, `npm run test:integration` e deploy/smoke opcionais.

### Baixa Prioridade ou Testes de Contrato

- Auditoria de arquivos fonte sem teste direto para separar lacuna real de codigo coberto indiretamente.

## Proximos Passos Recomendados

1. Auditar arquivos fonte sem teste direto e classificar o que precisa de cobertura propria, contrato ou integracao.
2. Cobrir utilitarios/model helpers puros que ainda ficarem fora da suite principal.
3. Expandir `npm run test:integration` para fluxos Prisma adicionais quando houver necessidade de validar comportamento contra schema real.
4. Validar o workflow em GitHub Actions real com push/PR ou disparo manual.
5. Expandir smoke tests operacionais se surgirem endpoints publicos adicionais para validar pos-deploy.

## Criterio de Qualidade Para Novos Testes

- Preferir testes deterministas e sem rede.
- Mockar providers externos.
- Testar comportamento publico, nao detalhes acidentais.
- Cobrir regra de negocio, erro esperado e autorizacao quando aplicavel.
- Manter fixtures pequenas e legiveis.
