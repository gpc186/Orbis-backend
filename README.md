# Orbis API

Back-end do **Orbis**, sistema de monitoramento industrial preditivo desenvolvido como TCC no SENAI. A API centraliza cadastro de máquinas e sensores, recebimento de leituras, alertas, manutenções, relatórios, assistente de IA e predição de risco operacional.

## Visão Geral

A API é responsável por:

- Autenticação com JWT, refresh token e controle de roles `ADMIN` e `TECNICO`.
- Gestão de usuários, técnicos, perfil, máquinas, sensores, leituras, alertas e manutenções.
- Monitoramento em tempo real com Socket.IO e integração MQTT/ESP32.
- Upload de imagens e manuais técnicos em PDF via Supabase Storage.
- Extração de especificações de manuais usando embeddings e IA.
- Dashboard operacional e assistente de IA com tools de leitura/escrita.
- Relatórios operacionais com preview, envio imediato, agendamento e histórico de execuções.
- Predição de manutenção e risco com regressão linear e fallback heurístico para máquinas críticas.

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
- Banco PostgreSQL acessível pela `DATABASE_URL`
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

Por padrão, se `PORT` não estiver definido, a aplicação sobe em:

```txt
http://localhost:3000
```

## Scripts

```bash
npm run dev        # inicia com nodemon
npm start          # inicia em modo normal
npm test           # roda a suíte automatizada
npm run test:ci    # roda testes e cobertura, mesmo comando usado no CI
npm run test:integration # roda integração Prisma contra banco de teste
npm run smoke:health # valida /health e /ready de uma URL publicada
npm run ci:local     # valida schema Prisma, testes, cobertura e integração segura
npm run simulador  # executa o simulador de leituras
```

## Variáveis de Ambiente

Crie um arquivo `.env` com base no `.env.example`.

Principais variáveis:

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
SIMULADOR_DEGRADACAO_HORAS=24
SIMULADOR_RUIDO_PERCENTUAL=0.01

PREDICAO_MIN_PONTOS_REGRESSAO=3
PREDICAO_MIN_JANELA_REGRESSAO_HORAS=0.05
PREDICAO_RISCO_MIN_PONTOS_HISTORICO=3
PREDICAO_RISCO_MIN_LEITURAS_24H=2
PREDICAO_RISCO_MIN_LEITURAS_72H=3
PREDICAO_ALERTA_MIN_AMOSTRAS_LIMIAR=1

REPORT_JOB_ENABLED=false
REPORT_JOB_CRON="* * * * *"

PORT=3000
NODE_ENV="DEVELOPMENT"
```

O fluxo de relatórios usa timezone fixo `America/Sao_Paulo`.

## Estrutura do Projeto

```txt
src/
|-- controllers/        # Camada HTTP
|-- jobs/               # Rotinas agendadas
|-- middlewares/        # Auth, roles, upload, erros e contexto
|-- models/             # Acesso ao banco via Prisma
|-- prisma/             # Cliente Prisma
|-- routes/             # Definição das rotas
|-- services/           # Regras de negócio
|   |-- aiTools/        # Tools, permissões e ações da IA
|-- templates/          # Templates de email/relatório
|-- utils/              # Validações, parsing, logger e helpers
|-- app.js              # App Express reutilizável em testes e runtime
|-- server.js           # Bootstrap da aplicação
tests/
|-- unit/               # Testes unitários/contrato espelhando as áreas de src
|-- integration/        # Testes com Prisma/banco real seguro
|-- ci/                 # Testes de contrato do workflow CI/CD
```

## Funcionalidades Principais

### Autenticação e Usuários

- Rotas protegidas exigem `Authorization: Bearer <token>`.
- O login retorna access token e refresh token.
- `ADMIN` pode cadastrar, editar e remover usuários.
- Usuários autenticados podem alterar o próprio status ativo pela rota `PUT /usuarios/alterar-ativo`.
- O perfil permite atualizar dados, foto e token de dispositivo.

### Máquinas, Sensores e Leituras

- Máquinas possuem criticidade, integridade, score de estabilidade e campos de previsão de manutenção.
- Sensores validam limites antes de salvar:
  - `idealTemperatura < limiteTemperatura`
  - `idealVibracao < limiteVibracao`
  - `desvioMaximoTemp > 0`
  - `desvioMaximoVibra > 0`
- `POST /leituras` é usado por integrações ESP32 e exige `x-api-key`.
- `GET /leituras` exige autenticação.
- Leituras atualizam sensor, integridade da máquina, histórico e podem gerar alertas.

### Alertas e Manutenções

- Alertas registram eventos de ciclo de vida.
- Um alerta pode ter várias manutenções, mas apenas uma manutenção `EM_ANDAMENTO`.
- Quando a manutenção é `RESOLVIDO`, o alerta também é resolvido.
- Quando a manutenção é `ENCERRADO_SEM_SOLUCAO`, o alerta volta para `ATIVO`.

### Predição e Risco

As rotas de predição continuam as mesmas, mas o payload de `/maquinas/:id/predicao-alertas` agora inclui estado operacional explícito.

Campos adicionados:

- `estadoPredicao`: `PREVISAO_VALIDA`, `MANUTENCAO_IMEDIATA`, `FALHA_JA_CRUZADA`, `MODELO_INVALIDO_COM_RISCO` ou `SEM_DADOS`.
- `fonteDecisao`: `REGRESSAO_LINEAR`, `HEURISTICA_CRITICA` ou `SEM_MODELO`.
- `urgencia`: `BAIXA`, `MEDIA`, `ALTA` ou `IMEDIATA`.
- `motivo`: código estável explicando a decisão.
- `modeloIntegridade`: inclui `pontosUsados`, `janelaHorasCoberta`, `ultimoPontoEm`, `r2` e `slope`.

Campos antigos como `proximoAlerta`, `instabilidade`, `ausenciaProximoAlerta`, `ausenciaInstabilidade` e `modeloIntegridade` foram preservados. Quando a regressão não é confiável, o sistema não inventa datas: ele retorna uma classificação operacional com fallback heurístico.

Os mínimos de histórico e leituras foram reduzidos para permitir validar o fluxo de predição em poucos minutos nas rotas normais.
Em `/maquinas/:id/predicao-alertas`, se ainda não houver alertas históricos suficientes, o sistema usa limiares operacionais marcados com `fonteLimiar: "OPERACIONAL"`.

A velocidade/sensibilidade da predição pode ser calibrada pelo ambiente:

- `PREDICAO_MIN_PONTOS_REGRESSAO`: pontos mínimos de integridade para regressão.
- `PREDICAO_MIN_JANELA_REGRESSAO_HORAS`: janela temporal mínima da regressão. `0.05` equivale a cerca de 3 minutos.
- `PREDICAO_RISCO_MIN_LEITURAS_24H` e `PREDICAO_RISCO_MIN_LEITURAS_72H`: leituras mínimas para calcular risco.
- `PREDICAO_ALERTA_MIN_AMOSTRAS_LIMIAR`: alertas históricos mínimos para estimar limiar por histórico.
- `PREDICAO_ALERTA_LIMIAR_INSTABILIDADE`, `PREDICAO_ALERTA_LIMIAR_TENDENCIA_CURTA` e `PREDICAO_ALERTA_LIMIAR_TENDENCIA_LONGA`: limiares operacionais usados quando ainda não há histórico suficiente.

### Dashboard e IA

- `GET /dashboard/resumo` retorna indicadores operacionais para admins.
- `POST /dashboard/ia/perguntar` permite perguntas em linguagem natural.
- A IA usa tools internas para consultar contexto operacional, máquinas, alertas e relatórios.
- Ações de escrita passam por confirmação/desambiguação antes de executar.
- Quando o provedor de IA ou alguma tool falha, o endpoint retorna fallback seguro com panorama básico.

### Relatórios

O domínio de relatórios suporta:

- Preview de relatório.
- Envio imediato.
- Agendamento.
- Atualização de status.
- Execução manual de agendamento.
- Consulta de execuções.
- Destinatários por email e seções configuráveis.

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

### Manual Técnico da Máquina

- `POST /maquinas` pode receber um PDF no campo multipart `manual`.
- `POST /maquinas/manual/preview` extrai especificações sem salvar arquivo nem alterar o banco.
- `PUT /maquinas/:id/manual` cria ou substitui o manual de uma máquina existente.
- O PDF é armazenado no bucket `machine-manuals`.
- O retorno expõe `manual.especificacoes`, mas não devolve texto extraído, chunks ou embeddings.

## Rotas

### Healthcheck

| Método | Rota | Acesso |
|---|---|---|
| GET | `/` | Público |
| GET | `/health` | Público |
| GET | `/ready` | Público |

### Auth e Senha

| Método | Rota | Acesso |
|---|---|---|
| POST | `/auth/login` | Público |
| POST | `/auth/refresh` | Público |
| POST | `/auth/logout` | Autenticado |
| DELETE | `/auth/logout-all` | Autenticado |
| POST | `/senha/esqueci-senha` | Público |
| POST | `/senha/validar-codigo` | Público |
| POST | `/senha/redefinir-senha` | Público |
| POST | `/senha/solicitar-alteracao` | Autenticado |
| POST | `/senha/confirmar-alteracao` | Autenticado |

### Perfil e Usuários

| Método | Rota | Acesso |
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

### Técnicos

| Método | Rota | Acesso |
|---|---|---|
| GET | `/tecnicos` | Autenticado |
| GET | `/tecnicos/:id` | Autenticado |
| GET | `/tecnicos/:id/alertas` | Autenticado |

### Máquinas e Sensores

| Método | Rota | Acesso |
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

### Leituras, Histórico, Alertas e Manutenções

| Método | Rota | Acesso |
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
| POST | `/manutencoes` | Admin, Técnico |
| GET | `/manutencoes/alerta/:id` | Admin, Técnico |
| GET | `/manutencoes/:id` | Admin, Técnico |
| PUT | `/manutencoes/:id` | Técnico |

### Dashboard, IA, Email e Relatórios

| Método | Rota | Acesso |
|---|---|---|
| GET | `/dashboard/resumo` | Admin |
| POST | `/dashboard/ia/perguntar` | Autenticado |
| POST | `/email` | Público com rate limit |
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
- Tamanho máximo: `15 MB`.
- A imagem é convertida para `webp`.

### Manuais

- Campo multipart esperado: `manual`.
- Formato aceito: `application/pdf`.
- Tamanho máximo: `25 MB`.
- No cadastro de máquina, envie os dados da máquina e o PDF no mesmo `multipart/form-data`.

## Jobs e Integrações

Ao iniciar o servidor, a aplicação carrega:

- `tendenciaJob`
- `relatorioJob`
- `limpezaJob`
- `sensorOfflineJob`
- `simuladorJob`, quando habilitado por ambiente
- Conexão MQTT, quando configurada

O `simuladorJob` degrada cada máquina linearmente ao longo do tempo, gerando leituras para todos os sensores ativos da máquina em cada ciclo.
A curva usa as specs de cada sensor: `idealTemperatura -> limiteTemperatura` e `idealVibracao -> limiteVibracao`.
`SIMULADOR_DEGRADACAO_HORAS` controla em quantas horas a leitura chega do ideal ao limite, e `SIMULADOR_RUIDO_PERCENTUAL` adiciona uma pequena variação percentual sobre a amplitude.

## Testes

A suíte automatizada roda com:

```bash
npm test
npm run test:coverage
npm run test:ci
npm run test:integration
npm run smoke:health
npm run ci:local
```

Ela cobre controllers, middlewares, contratos HTTP de rotas principais, services, tools de IA, relatórios, templates, predição, validações de sensores e fluxos críticos de dashboard/confirmação.

Os testes ficam separados do código de produção em `tests/`:

- `tests/unit/<area>` espelha as principais pastas de `src/`, como `controllers`, `services`, `routes`, `models` e `utils`.
- `tests/integration` concentra cenários que podem usar banco real de teste.
- `tests/ci` valida contratos do pipeline, como gatilhos, Postgres descartável e smoke/deploy opcionais.

Os testes de integração rodam em uma suíte separada e exigem `NODE_ENV=TEST` com `DATABASE_URL` apontando para banco seguro/de teste.

O smoke test exige `SMOKE_BASE_URL` ou uma URL base como argumento:

```bash
npm run smoke:health -- https://sua-api.onrender.com
```

## CI/CD

O repositório possui workflow em `.github/workflows/ci-cd.yml`.

- Em pull requests para `main`, o pipeline instala dependências, gera o Prisma Client e roda `npm run test:ci`.
- O pipeline sobe um Postgres descartável, aplica `npx prisma db push --skip-generate` e roda `npm run test:integration`.
- O workflow também pode ser disparado manualmente pelo GitHub Actions.
- Em push para `main`, após os testes, o workflow tenta disparar deploy no Render via secret `RENDER_DEPLOY_HOOK_URL`.
- Se o secret `SMOKE_BASE_URL` estiver configurado, o workflow aguarda brevemente e valida `/health` e `/ready` após o deploy.
- Se o secret não estiver configurado, a etapa de deploy é pulada sem falhar o pipeline.

Veja também [docs/ci-cd-runbook.md](docs/ci-cd-runbook.md).

## Insomnia

As coleções e ambientes de teste ficam em `docs/insomnia`.

Arquivos úteis:

- `orbis-unified-environment.json`: ambiente unificado com variáveis compartilhadas.
- `orbis-smoke-final-insomnia.json`: smoke tests finais de rotas principais.
- `orbis-predicao-alertas-insomnia.json`: testes focados em predição.
- `orbis-ai-insomnia.json` e `orbis-ai-confirmacoes-insomnia.json`: testes do assistente de IA.
- `orbis-relatorios-insomnia.json`: testes de relatórios.

## Observações

- O bootstrap executa `validarEnv()` para impedir subida com ambiente incompleto.
- `GET /ready` valida dependências importantes e pode retornar `503` quando o serviço não estiver pronto.
- Mudanças recentes de contrato foram aditivas, principalmente em `/maquinas/:id/predicao-alertas`.
- Estados heurísticos de predição podem não ter data de manutenção, mas sempre retornam motivo e urgência operacional.
