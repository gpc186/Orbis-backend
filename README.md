# Orbis — API

Back-end do sistema de monitoramento industrial preditivo Orbis, desenvolvido como TCC do curso de Desenvolvimento de Sistemas no SENAI.

---

## Tecnologias

- **Node.js + JavaScript** — runtime e linguagem
- **Express** — framework HTTP
- **Prisma ORM** — acesso ao banco de dados
- **MySQL** — banco de dados relacional
- **Socket.io** — alertas em tempo real via WebSocket
- **JWT + Refresh Token** — autenticação
- **node-cron** — tarefas agendadas
- **OneSignal** — notificações push (via FCM)

---

## Como rodar localmente

### Pré-requisitos

- Node.js 18+
- MySQL rodando localmente ou acesso ao Aiven

### Instalação

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/orbis-api.git
cd orbis-api

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env
# edite o .env com suas credenciais

# Rode as migrations do banco
npx prisma migrate dev

# Inicie o servidor
npm run dev
```

A API estará disponível em `http://localhost:3333`.

---

## Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto baseado no `.env.example`:

```env
# Banco de dados
DATABASE_URL="mysql://usuario:senha@host:porta/orbis?ssl-mode=REQUIRED"

# JWT
JWT_SECRET="sua-chave-secreta-aqui"
JWT_EXPIRES_IN="30m"
REFRESH_TOKEN_EXPIRES_IN="7d"

# ESP32
ESP32_API_KEY="chave-do-esp32-aqui"

# OneSignal
ONESIGNAL_APP_ID="seu-app-id"
ONESIGNAL_API_KEY="sua-api-key"

# Servidor
PORT=3333
```

>  Nunca suba o `.env` ou o `ca.pem` para o repositório!

---

## Estrutura de Pastas

```
src/
├── controllers/        → recebe req e devolve res
├── services/           → lógica de negócio
├── models/             → acesso ao banco via Prisma
│   ├── prisma.js            ← instância única do Prisma client
│   ├── usuarioModel.js
│   ├── maquinaModel.js
│   ├── sensorModel.js
│   ├── leituraModel.js
│   ├── alertaModel.js
│   ├── manutencaoModel.js
│   └── refreshTokenModel.js
├── routes/             → definição das rotas
├── middlewares/
│   ├── authMiddleware.js    ← valida JWT
│   └── apiKeyMiddleware.js  ← valida chave do ESP32
├── socket/
│   └── index.js            ← configuração do Socket.io
├── jobs/
│   ├── tendenciaJob.js     ← detecta tendência de alta em 2h (30min)
│   ├── sensorOfflineJob.js ← marca sensores inativos offline (5min)
│   └── limpezaJob.js       ← remove leituras com +30 dias (diário)
└── server.js
```

---

## Banco de Dados

```
USUARIO       id, nome, email, senha, role (ADMIN|TECNICO), ativo,
              especialidade, telefone, oneSignalId, atualizadoEm

MAQUINA       id, nome, setor, tipo, criticidade (BAIXA|MEDIA|ALTA)

SENSOR        id, maquinaId*, tipo, status (ONLINE|OFFLINE),
              limiteTemperatura, limiteVibracao, ultimaLeituraEm

LEITURA       id, sensorId*, temperatura, vibracao, criadoEm

ALERTA        id, sensorId*, maquinaId*, tipo, status, mensagem, criadoEm
              tipo: LIMITE_ULTRAPASSADO | TENDENCIA_CURTA | TENDENCIA_LONGA
              status: ATIVO | EM_ANDAMENTO | RESOLVIDO

MANUTENCAO    id, alertaId*, usuarioId*, observacao, status, criadoEm
              status: EM_ANDAMENTO | RESOLVIDO

REFRESH_TOKEN id, usuarioId*, token, expiresAt, criadoEm
```

`*` chave estrangeira (FK)

---

## Contratos da API

> **Base URL desenvolvimento:** `http://localhost:3333`
> **Base URL produção:** `https://orbis-api.fly.dev`

### Autenticação

Rotas protegidas exigem o header:
```
Authorization: Bearer <accessToken>
```

Rota de leituras do ESP32 exige:
```
x-api-key: <chave>
```

### Paginação

Endpoints de listagem aceitam `?page=1&limit=20` e retornam:
```json
{
  "dados": [...],
  "total": 100,
  "page": 1,
  "totalPages": 5
}
```

---

### Auth
| Método | Rota | Acesso | Entrada | Saída |
|---|---|---|---|---|
| POST | /auth/login | Público | `{ email, senha }` | `{ accessToken, refreshToken, usuario }` |
| POST | /auth/refresh | Público | `{ refreshToken }` | `{ accessToken }` |
| POST | /auth/logout | Autenticado | `{ refreshToken }` | `{ mensagem }` |

### Perfil
| Método | Rota | Acesso | Entrada | Saída |
|---|---|---|---|---|
| GET | /perfil | Autenticado | — | `{ id, nome, email, role, especialidade, telefone, ativo }` |
| PUT | /perfil | Autenticado | `{ nome, telefone, especialidade, senha }` | `{ id, nome, telefone, especialidade }` |
| POST | /perfil/device-token | Autenticado | `{ oneSignalId }` | `{ mensagem }` |

### Usuários
| Método | Rota | Acesso | Entrada | Saída |
|---|---|---|---|---|
| GET | /usuarios | Admin | `?page&limit` | paginado |
| GET | /usuarios/:id | Admin | — | `{ id, nome, email, role, especialidade, telefone, ativo }` |
| GET | /usuarios/:id/historico | Admin | `?page&limit` | paginado |
| POST | /usuarios | Admin | `{ nome, email, senha, role, especialidade, telefone }` | `{ id, nome, email, role }` |
| PUT | /usuarios/:id | Admin | `{ nome, email, role, especialidade, telefone }` | `{ id, nome, email, role }` |
| DELETE | /usuarios/:id | Admin | — | `{ mensagem }` |

> Admin não pode excluir outro Admin nem rebaixar o único Admin existente.

### Técnicos
| Método | Rota | Acesso | Entrada | Saída |
|---|---|---|---|---|
| GET | /tecnicos | Admin | `?page&limit` | paginado |
| GET | /tecnicos/:id | Admin | — | `{ id, nome, especialidade, ativo, alertaEmAndamento }` |

### Máquinas
| Método | Rota | Acesso | Entrada | Saída |
|---|---|---|---|---|
| GET | /maquinas | Admin, Técnico | `?page&limit` | paginado |
| GET | /maquinas/:id | Admin, Técnico | — | `{ id, nome, setor, tipo, criticidade, sensores }` |
| POST | /maquinas | Admin | `{ nome, setor, tipo, criticidade }` | `{ id, nome, setor, tipo, criticidade }` |
| PUT | /maquinas/:id | Admin | `{ nome, setor, tipo, criticidade }` | `{ id, nome, setor, tipo, criticidade }` |
| DELETE | /maquinas/:id | Admin | — | `{ mensagem }` |

### Sensores
| Método | Rota | Acesso | Entrada | Saída |
|---|---|---|---|---|
| GET | /sensores | Admin | `?page&limit` | paginado |
| GET | /sensores/:id | Admin, Técnico | — | `{ id, maquinaId, tipo, status, limites }` |
| POST | /sensores | Admin | `{ maquinaId, tipo, limiteTemperatura, limiteVibracao }` | `{ id, maquinaId, tipo, status }` |
| PUT | /sensores/:id | Admin | `{ limiteTemperatura, limiteVibracao, status }` | `{ id, limites, status }` |
| DELETE | /sensores/:id | Admin | — | `{ mensagem }` |

### Leituras
| Método | Rota | Acesso | Entrada | Saída |
|---|---|---|---|---|
| POST | /leituras | ESP32 (x-api-key) | `{ sensor_id, timestamp, temperatura, vibracao }` | `{ id, criadoEm }` |
| GET | /leituras/:sensorId | Admin, Técnico | `?periodo=24h\|7d&page&limit` | paginado |

### Alertas
| Método | Rota | Acesso | Entrada | Saída |
|---|---|---|---|---|
| GET | /alertas | Admin, Técnico | `?page&limit` | paginado |
| GET | /alertas/:id | Admin, Técnico | — | `{ id, maquinaId, sensorId, tipo, status, mensagem, criadoEm }` |
| GET | /alertas/maquina/:maquinaId | Admin, Técnico | `?page&limit` | paginado |
| PATCH | /alertas/:id/status | Admin, Técnico | `{ status }` | `{ id, status }` |

> Alertas ordenados por criticidade da máquina (ALTA → MEDIA → BAIXA).

### Manutenções
| Método | Rota | Acesso | Entrada | Saída |
|---|---|---|---|---|
| GET | /manutencoes | Admin | `?page&limit` | paginado |
| GET | /manutencoes/:alertaId | Admin, Técnico | — | `[{ id, usuarioId, observacao, status, criadoEm }]` |
| POST | /manutencoes | Técnico | `{ alertaId, observacao, status }` | `{ id, alertaId, status, criadoEm }` |
| PUT | /manutencoes/:id | Técnico | `{ observacao, status }` | `{ id, observacao, status }` |

### Dashboard
| Método | Rota | Acesso | Entrada | Saída |
|---|---|---|---|---|
| GET | /dashboard/resumo | Admin | — | `{ totalMaquinas, maquinasEmAlerta, alertasAtivos, alertasHoje, tecnicosAtivos }` |

---

## WebSocket

Evento emitido pela API ao gerar um alerta:
```
alerta → { id, maquinaId, mensagem, tipo, status }
```

Conectar usando o `accessToken` no momento da conexão para autenticação.

E o mais importante, lembre-se de se divertir! 😁
