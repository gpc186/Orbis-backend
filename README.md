# Orbis API

Back-end do **Orbis**, sistema de monitoramento industrial preditivo desenvolvido como TCC no SENAI. A API centraliza cadastro de maquinas e sensores, recebimento de leituras, alertas, manutencoes, relatorios, assistente de IA e predicao de risco operacional.

## Visao Geral

A API e responsavel por:

- Autenticacao com JWT, refresh token e controle de roles `ADMIN` e `TECNICO`.
- Gestao de usuarios, tecnicos, perfil, maquinas, sensores, leituras, alertas e manutencoes.
- Monitoramento em tempo real com Socket.IO e integracao MQTT/ESP32.
- Upload de imagens e manuais tecnicos em PDF via Supabase Storage.
- Extracao de especificacoes de manuais usando embeddings e IA.
- Dashboard operacional e assistente de IA com tools de leitura/escrita.
- Relatorios operacionais com preview, envio imediato, agendamento e historico de execucoes.
- Predicao de manutencao e risco com regressao linear e fallback heuristico para maquinas criticas.

## Tecnologias

- Node.js e JavaScript
- Express
- Prisma ORM
- PostgreSQL
- JWT
- Socket.IO
- MQTT
- node-cron
- Supabase Storage
- Multer e Sharp
- Groq e Gemini
- Resend
- Node Test Runner

## Requisitos

- Node.js 18 ou superior
- Banco PostgreSQL acessivel pela `DATABASE_URL`
- Buckets no Supabase Storage:
  - `profile-images`
  - `machine-images`
  - `machine-manuals`
- Chaves de IA configuradas quando os fluxos de manual/assistente forem usados

## Como Executar

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

Por padrao, se `PORT` nao estiver definido, a aplicacao sobe em:

```txt
http://localhost:3000
```

## Scripts

```bash
npm run dev        # inicia com nodemon
npm start          # inicia em modo normal
npm test           # roda a suite automatizada
npm run test:ci    # roda testes e cobertura, mesmo comando usado no CI
npm run test:integration # roda integracao Prisma contra banco de teste
npm run smoke:health # valida /health e /ready de uma URL publicada
npm run ci:local     # valida schema Prisma, testes, cobertura e integracao segura
npm run simulador  # executa o simulador de leituras
```

## Variaveis de Ambiente

Crie um arquivo `.env` com base no `.env.example`.

Principais variaveis:

```env
DATABASE_URL="postgresql://..."
JWT_SECRET="sua_chave_jwt"
JWT_EXPIRES_IN="30m"
REFRESH_TOKEN_EXPIRES_IN_DAYS="7"

SUPABASE_URL="sua_url_do_supabase"
SUPABASE_SERVICE_ROLE="sua_service_role"

GROQ_API_KEY="sua_chave_groq"
GROQ_MODEL="llama-3.3-70b-versatile"
GEMINI_API_KEY="sua_chave_gemini"
EMBEDDING_PROVIDER="gemini"
GEMINI_EMBEDDING_MODEL="gemini-embedding-001"

ESP32_API_KEY="chave_do_esp32"
MQTT_URL="mqtt://..."
MQTT_USER="usuario_mqtt"
MQTT_PASS="senha_mqtt"

SENSOR_OFFLINE_JOB_ENABLED=true
SENSOR_OFFLINE_INTERVAL_SECONDS=60
SIMULADOR_JOB_ATIVO=false
SIMULADOR_INTERVALO_MS=5000

REPORT_JOB_ENABLED=false
REPORT_JOB_CRON="* * * * *"

PORT=3000
NODE_ENV="DEVELOPMENT"
```

O fluxo de relatorios usa timezone fixo `America/Sao_Paulo`.

## Estrutura do Projeto

```txt
src/
|-- controllers/        # Camada HTTP
|-- jobs/               # Rotinas agendadas
|-- middlewares/        # Auth, roles, upload, erros e contexto
|-- models/             # Acesso ao banco via Prisma
|-- prisma/             # Cliente Prisma
|-- routes/             # Definicao das rotas
|-- services/           # Regras de negocio
|   |-- aiTools/        # Tools, permissoes e acoes da IA
|-- templates/          # Templates de email/relatorio
|-- utils/              # Validacoes, parsing, logger e helpers
|-- app.js              # App Express reutilizavel em testes e runtime
|-- server.js           # Bootstrap da aplicacao
tests/
|-- unit/               # Testes unitarios/contrato espelhando as areas de src
|-- integration/        # Testes com Prisma/banco real seguro
|-- ci/                 # Testes de contrato do workflow CI/CD
```

## Funcionalidades Principais

### Autenticacao e Usuarios

- Rotas protegidas exigem `Authorization: Bearer <token>`.
- O login retorna access token e refresh token.
- `ADMIN` pode cadastrar, editar e remover usuarios.
- Usuarios autenticados podem alterar o proprio status ativo pela rota `PUT /usuarios/alterar-ativo`.
- O perfil permite atualizar dados, foto e token de dispositivo.

### Maquinas, Sensores e Leituras

- Maquinas possuem criticidade, integridade, score de estabilidade e campos de previsao de manutencao.
- Sensores validam limites antes de salvar:
  - `idealTemperatura < limiteTemperatura`
  - `idealVibracao < limiteVibracao`
  - `desvioMaximoTemp > 0`
  - `desvioMaximoVibra > 0`
- `POST /leituras` e usado por integracoes ESP32 e exige `x-api-key`.
- `GET /leituras` exige autenticacao.
- Leituras atualizam sensor, integridade da maquina, historico e podem gerar alertas.

### Alertas e Manutencoes

- Alertas registram eventos de ciclo de vida.
- Um alerta pode ter varias manutencoes, mas apenas uma manutencao `EM_ANDAMENTO`.
- Quando a manutencao e `RESOLVIDO`, o alerta tambem e resolvido.
- Quando a manutencao e `ENCERRADO_SEM_SOLUCAO`, o alerta volta para `ATIVO`.

### Predicao e Risco

As rotas de predicao continuam as mesmas, mas o payload de `/maquinas/:id/predicao-alertas` agora inclui estado operacional explicito.

Campos adicionados:

- `estadoPredicao`: `PREVISAO_VALIDA`, `MANUTENCAO_IMEDIATA`, `FALHA_JA_CRUZADA`, `MODELO_INVALIDO_COM_RISCO` ou `SEM_DADOS`.
- `fonteDecisao`: `REGRESSAO_LINEAR`, `HEURISTICA_CRITICA` ou `SEM_MODELO`.
- `urgencia`: `BAIXA`, `MEDIA`, `ALTA` ou `IMEDIATA`.
- `motivo`: codigo estavel explicando a decisao.
- `modeloIntegridade`: inclui `pontosUsados`, `janelaHorasCoberta`, `ultimoPontoEm`, `r2` e `slope`.

Campos antigos como `proximoAlerta`, `instabilidade`, `ausenciaProximoAlerta`, `ausenciaInstabilidade` e `modeloIntegridade` foram preservados. Quando a regressao nao e confiavel, o sistema nao inventa datas: ele retorna uma classificacao operacional com fallback heuristico.

### Dashboard e IA

- `GET /dashboard/resumo` retorna indicadores operacionais para admins.
- `POST /dashboard/ia/perguntar` permite perguntas em linguagem natural.
- A IA usa tools internas para consultar contexto operacional, maquinas, alertas e relatorios.
- Acoes de escrita passam por confirmacao/desambiguacao antes de executar.
- Quando o provedor de IA ou alguma tool falha, o endpoint retorna fallback seguro com panorama basico.

### Relatorios

O dominio de relatorios suporta:

- Preview de relatorio.
- Envio imediato.
- Agendamento.
- Atualizacao de status.
- Execucao manual de agendamento.
- Consulta de execucoes.
- Destinatarios por email e secoes configuraveis.

Principais rotas:

- `POST /relatorios/preview`
- `POST /relatorios/enviar-agora`
- `POST /relatorios/agendamentos`
- `GET /relatorios/agendamentos`
- `GET /relatorios/agendamentos/:id`
- `PATCH /relatorios/agendamentos/:id`
- `PATCH /relatorios/agendamentos/:id/status`
- `POST /relatorios/agendamentos/:id/executar-agora`
- `GET /relatorios/agendamentos/:id/execucoes`

### Manual Tecnico da Maquina

- `POST /maquinas` pode receber um PDF no campo multipart `manual`.
- `POST /maquinas/manual/preview` extrai especificacoes sem salvar arquivo nem alterar o banco.
- `PUT /maquinas/:id/manual` cria ou substitui o manual de uma maquina existente.
- O PDF e armazenado no bucket `machine-manuals`.
- O retorno expoe `manual.especificacoes`, mas nao devolve texto extraido, chunks ou embeddings.

## Rotas

### Healthcheck

| Metodo | Rota | Acesso |
|---|---|---|
| GET | `/` | Publico |
| GET | `/health` | Publico |
| GET | `/ready` | Publico |

### Auth e Senha

| Metodo | Rota | Acesso |
|---|---|---|
| POST | `/auth/login` | Publico |
| POST | `/auth/refresh` | Publico |
| POST | `/auth/logout` | Autenticado |
| DELETE | `/auth/logout-all` | Autenticado |
| POST | `/senha/esqueci-senha` | Publico |
| POST | `/senha/validar-codigo` | Publico |
| POST | `/senha/redefinir-senha` | Publico |
| POST | `/senha/solicitar-alteracao` | Autenticado |
| POST | `/senha/confirmar-alteracao` | Autenticado |

### Perfil e Usuarios

| Metodo | Rota | Acesso |
|---|---|---|
| GET | `/perfil` | Autenticado |
| PUT | `/perfil` | Autenticado |
| PUT | `/perfil/foto` | Autenticado |
| POST | `/perfil/device-token` | Autenticado |
| POST | `/perfil/push-teste` | Autenticado |
| GET | `/usuarios` | Autenticado |
| GET | `/usuarios/:id` | Autenticado |
| POST | `/usuarios` | Admin |
| PUT | `/usuarios/:id` | Admin |
| DELETE | `/usuarios/:id` | Admin |
| PUT | `/usuarios/alterar-ativo` | Autenticado |

### Tecnicos

| Metodo | Rota | Acesso |
|---|---|---|
| GET | `/tecnicos` | Autenticado |
| GET | `/tecnicos/:id` | Autenticado |
| GET | `/tecnicos/:id/alertas` | Autenticado |

### Maquinas e Sensores

| Metodo | Rota | Acesso |
|---|---|---|
| POST | `/maquinas` | Autenticado |
| POST | `/maquinas/manual/preview` | Autenticado |
| GET | `/maquinas` | Autenticado |
| GET | `/maquinas/:id` | Autenticado |
| GET | `/maquinas/:id/predicao-alertas` | Autenticado |
| GET | `/maquinas/:id/predicao-risco` | Autenticado |
| GET | `/maquinas/:id/historico-integridade` | Autenticado |
| PUT | `/maquinas/:id` | Autenticado |
| PUT | `/maquinas/:id/foto` | Autenticado |
| PUT | `/maquinas/:id/manual` | Autenticado |
| DELETE | `/maquinas/:id` | Autenticado |
| POST | `/sensores` | Autenticado |
| GET | `/sensores` | Autenticado |
| GET | `/sensores/:id` | Autenticado |
| PUT | `/sensores/:id` | Autenticado |
| DELETE | `/sensores/:id` | Autenticado |

### Leituras, Historico, Alertas e Manutencoes

| Metodo | Rota | Acesso |
|---|---|---|
| POST | `/leituras` | ESP32 API key |
| GET | `/leituras` | Autenticado |
| POST | `/historico-integridade` | Autenticado |
| GET | `/historico-integridade` | Autenticado |
| GET | `/historico-integridade/:id` | Autenticado |
| GET | `/alertas/resumo` | Autenticado |
| GET | `/alertas/eventos` | Autenticado |
| GET | `/alertas` | Autenticado |
| GET | `/alertas/:id` | Autenticado |
| GET | `/alertas/:id/eventos` | Autenticado |
| GET | `/manutencoes` | Admin |
| POST | `/manutencoes` | Admin, Tecnico |
| GET | `/manutencoes/alerta/:id` | Admin, Tecnico |
| GET | `/manutencoes/:id` | Admin, Tecnico |
| PUT | `/manutencoes/:id` | Tecnico |

### Dashboard, IA, Email e Relatorios

| Metodo | Rota | Acesso |
|---|---|---|
| GET | `/dashboard/resumo` | Admin |
| POST | `/dashboard/ia/perguntar` | Autenticado |
| POST | `/email` | Publico com rate limit |
| POST | `/relatorios/preview` | Autenticado |
| POST | `/relatorios/enviar-agora` | Autenticado |
| POST | `/relatorios/agendamentos` | Autenticado |
| GET | `/relatorios/agendamentos` | Autenticado |
| GET | `/relatorios/agendamentos/:id` | Autenticado |
| PATCH | `/relatorios/agendamentos/:id` | Autenticado |
| DELETE | `/relatorios/agendamentos/:id` | Autenticado |
| PATCH | `/relatorios/agendamentos/:id/status` | Autenticado |
| POST | `/relatorios/agendamentos/:id/executar-agora` | Autenticado |
| GET | `/relatorios/agendamentos/:id/execucoes` | Autenticado |

## Uploads

### Imagens

- Campo multipart esperado: `imagem`.
- Formatos aceitos: `image/png`, `image/jpg`, `image/jpeg`, `image/webp`.
- Tamanho maximo: `15 MB`.
- A imagem e convertida para `webp`.

### Manuais

- Campo multipart esperado: `manual`.
- Formato aceito: `application/pdf`.
- Tamanho maximo: `25 MB`.
- No cadastro de maquina, envie os dados da maquina e o PDF no mesmo `multipart/form-data`.

## Jobs e Integracoes

Ao iniciar o servidor, a aplicacao carrega:

- `tendenciaJob`
- `relatorioJob`
- `limpezaJob`
- `sensorOfflineJob`
- `simuladorJob`, quando habilitado por ambiente
- Conexao MQTT, quando configurada

## Testes

A suite automatizada roda com:

```bash
npm test
npm run test:coverage
npm run test:ci
npm run test:integration
npm run smoke:health
npm run ci:local
```

Ela cobre controllers, middlewares, contratos HTTP de rotas principais, services, tools de IA, relatorios, templates, predicao, validacoes de sensores e fluxos criticos de dashboard/confirmacao.

Os testes ficam separados do codigo de producao em `tests/`:

- `tests/unit/<area>` espelha as principais pastas de `src/`, como `controllers`, `services`, `routes`, `models` e `utils`.
- `tests/integration` concentra cenarios que podem usar banco real de teste.
- `tests/ci` valida contratos do pipeline, como gatilhos, Postgres descartavel e smoke/deploy opcionais.

Os testes de integracao rodam em uma suite separada e exigem `NODE_ENV=TEST` com `DATABASE_URL` apontando para banco seguro/de teste.

O smoke test exige `SMOKE_BASE_URL` ou uma URL base como argumento:

```bash
npm run smoke:health -- https://sua-api.onrender.com
```

## CI/CD

O reposititorio possui workflow em `.github/workflows/ci-cd.yml`.

- Em pull requests para `main`, o pipeline instala dependencias, gera o Prisma Client e roda `npm run test:ci`.
- O pipeline sobe um Postgres descartavel, aplica `npx prisma db push --skip-generate` e roda `npm run test:integration`.
- O workflow tambem pode ser disparado manualmente pelo GitHub Actions.
- Em push para `main`, apos os testes, o workflow tenta disparar deploy no Render via secret `RENDER_DEPLOY_HOOK_URL`.
- Se o secret `SMOKE_BASE_URL` estiver configurado, o workflow aguarda brevemente e valida `/health` e `/ready` apos o deploy.
- Se o secret nao estiver configurado, a etapa de deploy e pulada sem falhar o pipeline.

Veja tambem [docs/ci-cd-runbook.md](docs/ci-cd-runbook.md).

## Insomnia

As colecoes e ambientes de teste ficam em `docs/insomnia`.

Arquivos uteis:

- `orbis-unified-environment.json`: ambiente unificado com variaveis compartilhadas.
- `orbis-smoke-final-insomnia.json`: smoke tests finais de rotas principais.
- `orbis-predicao-alertas-insomnia.json`: testes focados em predicao.
- `orbis-ai-insomnia.json` e `orbis-ai-confirmacoes-insomnia.json`: testes do assistente de IA.
- `orbis-relatorios-insomnia.json`: testes de relatorios.

## Observacoes

- O bootstrap executa `validarEnv()` para impedir subida com ambiente incompleto.
- `GET /ready` valida dependencias importantes e pode retornar `503` quando o servico nao estiver pronto.
- Mudancas recentes de contrato foram aditivas, principalmente em `/maquinas/:id/predicao-alertas`.
- Estados heuristicos de predicao podem nao ter data de manutencao, mas sempre retornam motivo e urgencia operacional.
