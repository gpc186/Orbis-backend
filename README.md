# Orbis API

Back-end do sistema **Orbis**, desenvolvido como TCC no SENAI para monitoramento industrial preditivo, gestão de alertas e fluxo de manutenção.

## Visão geral

A API é responsável por:

- autenticação com JWT e refresh token;
- cadastro e gestão de usuários, técnicos, máquinas e sensores;
- recebimento de leituras de sensores;
- geração de alertas operacionais;
- controle de manutenções vinculadas aos alertas;
- upload de imagens de perfil e de máquinas;
- consolidação de dados para dashboard.

## Tecnologias

- **Node.js** com **JavaScript**
- **Express**
- **Prisma ORM**
- **PostgreSQL**
- **JWT**
- **Socket.IO**
- **node-cron**
- **Supabase Storage**
- **Multer** e **Sharp**

## Requisitos

- Node.js 18 ou superior
- Banco PostgreSQL acessível pela `DATABASE_URL`
- Buckets no Supabase Storage para imagens:
  - `profile-images`
  - `machine-images`

## Como executar

```bash
npm install
npx prisma migrate dev
npm run dev
```

Por padrão, a aplicação sobe em:

```txt
http://localhost:3333
```

## Variáveis de ambiente

Crie um arquivo `.env` com base no `.env.example`.

### Obrigatórias

```env
DATABASE_URL="sua_url_do_postgres"
JWT_SECRET="sua_chave_jwt"
SUPABASE_URL="sua_url_do_supabase"
SUPABASE_SERVICE_ROLE="sua_service_role"
```

### Utilizadas pela aplicação

```env
JWT_EXPIRES_IN="30m"
REFRESH_TOKEN_EXPIRES_IN_DAYS="7"
ESP32_API_KEY="chave_do_esp32"
PORT=3333
NODE_ENV="DEVELOPMENT"
```

## Scripts

```bash
npm run dev
npm start
```

## Estrutura do projeto

```txt
src/
├── controllers/     # Camada HTTP
├── jobs/            # Rotinas agendadas
├── middlewares/     # Autenticação, roles, upload e erros
├── models/          # Acesso ao banco via Prisma
├── prisma/          # Cliente Prisma
├── routes/          # Definição das rotas
├── services/        # Regras de negócio
├── utils/           # Utilitários e validação de ambiente
└── server.js        # Bootstrap da aplicação
```

## Modelo de dados

### Usuário

- `id`
- `nome`
- `email`
- `senha`
- `role`: `ADMIN` | `TECNICO`
- `ativo`
- `especialidade`
- `telefone`
- `oneSignalId`
- `fotoPerfil`
- `caminhoFoto`
- `criadoEm`
- `atualizadoEm`

### Máquina

- `id`
- `nome`
- `setor`
- `tipo`
- `criticidade`: `BAIXA` | `MEDIA` | `ALTA`
- `ativo`
- `integridade`
- `scoreEstabilidade`
- `previsaoManutencao`
- `janelaManuInicio`
- `janelaManuFim`
- `imagem`
- `caminhoImagem`
- `criadoEm`

### Sensor

- `id`
- `maquinaId`
- `tipo`
- `status`: `ONLINE` | `OFFLINE` | `INATIVO`
- `limiteTemperatura`
- `idealTemperatura`
- `limiteVibracao`
- `idealVibracao`
- `desvioMaximoTemp`
- `desvioMaximoVibra`
- `ultimaTemperatura`
- `ultimaVibracao`
- `ultimaLeituraEm`
- `criadoEm`

### Leitura

- `id`
- `sensorId`
- `temperatura`
- `vibracao`
- `criadoEm`

### Alerta

- `id`
- `sensorId`
- `maquinaId`
- `tecnicoId`
- `tipo`: `LIMITE_ULTRAPASSADO` | `TENDENCIA_CURTA` | `TENDENCIA_LONGA` | `DEGRADACAO_ACELERADA` | `INSTABILIDADE`
- `status`: `ATIVO` | `EM_ANDAMENTO` | `RESOLVIDO` | `CANCELADO`
- `mensagem`
- `criadoEm`

### AlertaEvento

- `id`
- `alertaId`
- `usuarioId`
- `tipo`: `CRIADO` | `ACEITO` | `ATUALIZADO` | `RESOLVIDO` | `CANCELADO`
- `descricao`
- `criadoEm`

### Manutenção

- `id`
- `alertaId`
- `usuarioId`
- `observacao`
- `status`: `EM_ANDAMENTO` | `RESOLVIDO` | `ENCERRADO_SEM_SOLUCAO`
- `criadoEm`

### RefreshToken

- `id`
- `usuarioId`
- `token`
- `expiresAt`
- `criadoEm`

## Regras de negócio importantes

### Autenticação

- rotas protegidas exigem `Authorization: Bearer <token>`;
- o fluxo de autenticação usa access token e refresh token;
- o middleware de autenticação valida o token e confere o usuário no banco.

### Perfil e imagens

- o usuário autenticado pode consultar e editar o próprio perfil;
- a foto de perfil é processada com `Sharp` antes do upload;
- imagens são armazenadas no Supabase Storage.

### Manutenção e alerta

- um alerta pode ter várias manutenções ao longo do tempo;
- apenas uma manutenção pode ficar `EM_ANDAMENTO` por alerta;
- quando a manutenção é `RESOLVIDO`, o alerta é encerrado como `RESOLVIDO`;
- quando a manutenção é `ENCERRADO_SEM_SOLUCAO`, o alerta volta para `ATIVO` e o técnico é desvinculado.

## Rotas

### Healthcheck

| Método | Rota | Acesso |
|---|---|---|
| GET | `/` | Público |
| GET | `/health` | Público |

### Auth

| Método | Rota | Acesso |
|---|---|---|
| POST | `/auth/login` | Público |
| POST | `/auth/refresh` | Público |
| POST | `/auth/logout` | Autenticado |
| DELETE | `/auth/logout-all` | Autenticado |

### Perfil

| Método | Rota | Acesso |
|---|---|---|
| GET | `/perfil` | Autenticado |
| PUT | `/perfil` | Autenticado |
| PUT | `/perfil/foto` | Autenticado |
| POST | `/perfil/device-token` | Autenticado |

### Usuários

| Método | Rota | Acesso |
|---|---|---|
| GET | `/usuarios` | Admin |
| GET | `/usuarios/:id` | Admin |
| POST | `/usuarios` | Admin |
| PUT | `/usuarios/:id` | Admin |
| DELETE | `/usuarios/:id` | Admin |

### Técnicos

| Método | Rota | Acesso |
|---|---|---|
| GET | `/tecnicos` | Admin |
| GET | `/tecnicos/:id` | Admin |
| GET | `/tecnicos/:id/alertas` | Admin |

### Máquinas

| Método | Rota | Acesso |
|---|---|---|
| POST | `/maquinas` | Autenticado |
| GET | `/maquinas` | Autenticado |
| GET | `/maquinas/:id` | Autenticado |
| PUT | `/maquinas/:id` | Autenticado |
| PUT | `/maquinas/:id/foto` | Autenticado |
| DELETE | `/maquinas/:id` | Autenticado |

### Sensores

| Método | Rota | Acesso |
|---|---|---|
| POST | `/sensores` | Autenticado |
| GET | `/sensores` | Autenticado |
| GET | `/sensores/:id` | Autenticado |
| PUT | `/sensores/:id` | Autenticado |
| DELETE | `/sensores/:id` | Autenticado |

### Leituras

| Método | Rota | Acesso |
|---|---|---|
| POST | `/leituras` | Público na branch atual |
| GET | `/leituras` | Público na branch atual |

> Observação: a proteção do endpoint de leituras pode variar de acordo com a branch em uso. Em outras branches do projeto, esse fluxo já está sendo tratado com `x-api-key` para integração com ESP32.

### Manutenções

| Método | Rota | Acesso |
|---|---|---|
| GET | `/manutencoes` | Admin |
| POST | `/manutencoes` | Admin, Técnico |
| GET | `/manutencoes/alerta/:id` | Admin, Técnico |
| GET | `/manutencoes/:id` | Admin, Técnico |
| PUT | `/manutencoes/:id` | Técnico |

### Dashboard

| Método | Rota | Acesso |
|---|---|---|
| GET | `/dashboard/resumo` | Admin |

## Upload de imagens

- campo esperado no multipart: `imagem`
- formatos aceitos:
  - `image/png`
  - `image/jpg`
  - `image/jpeg`
  - `image/webp`
- tamanho máximo: `15 MB`
- a imagem é convertida para `webp`

## Jobs agendados

Ao iniciar o servidor, a aplicação também carrega:

- `tendenciaJob`
- `limpezaJob`
- `sensorOfflineJob`

## Observações

- o projeto utiliza `validarEnv()` no bootstrap para impedir subida com ambiente incompleto;
- o repositório ainda não possui suíte formal de testes automatizados;
- o `README` descreve o estado atual desta branch.