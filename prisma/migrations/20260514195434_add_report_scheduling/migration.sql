-- CreateEnum
CREATE TYPE "FrequenciaRelatorio" AS ENUM ('DIARIO', 'SEMANAL', 'MENSAL');

-- CreateEnum
CREATE TYPE "StatusAgendamentoRelatorio" AS ENUM ('ATIVO', 'PAUSADO', 'ERRO');

-- CreateEnum
CREATE TYPE "TipoPeriodoRelatorio" AS ENUM ('RELATIVE_DAYS', 'CUSTOM_RANGE');

-- CreateEnum
CREATE TYPE "TipoExecucaoRelatorio" AS ENUM ('MANUAL', 'AGENDADO');

-- CreateEnum
CREATE TYPE "StatusExecucaoRelatorio" AS ENUM ('PROCESSANDO', 'ENVIADO', 'PARCIAL', 'FALHOU');

-- CreateTable
CREATE TABLE "RelatorioAgendamento" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "criadoPorId" INTEGER NOT NULL,
    "status" "StatusAgendamentoRelatorio" NOT NULL DEFAULT 'ATIVO',
    "frequencia" "FrequenciaRelatorio" NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "hora" INTEGER NOT NULL,
    "minuto" INTEGER NOT NULL DEFAULT 0,
    "diaSemana" INTEGER,
    "diaMes" INTEGER,
    "assunto" TEXT,
    "tipoPeriodo" "TipoPeriodoRelatorio" NOT NULL,
    "periodo" JSONB NOT NULL,
    "filtros" JSONB NOT NULL,
    "secoes" JSONB,
    "proximoEnvioEm" TIMESTAMP(3) NOT NULL,
    "ultimoEnvioEm" TIMESTAMP(3),
    "ultimoSucessoEm" TIMESTAMP(3),
    "ultimoErroEm" TEXT,
    "lockedAt" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RelatorioAgendamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelatorioDestinatario" (
    "id" SERIAL NOT NULL,
    "agendamentoId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "nome" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RelatorioDestinatario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelatorioExecucao" (
    "id" SERIAL NOT NULL,
    "agendamentoId" INTEGER,
    "tipoExecucao" "TipoExecucaoRelatorio" NOT NULL,
    "status" "StatusExecucaoRelatorio" NOT NULL DEFAULT 'PROCESSANDO',
    "assunto" TEXT NOT NULL,
    "emailsDestino" JSONB NOT NULL,
    "periodoSnapshot" JSONB NOT NULL,
    "filtrosSnapshot" JSONB NOT NULL,
    "secoes" JSONB,
    "provider" TEXT,
    "messageId" TEXT,
    "erro" TEXT,
    "iniciadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizadoEm" TIMESTAMP(3),

    CONSTRAINT "RelatorioExecucao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RelatorioAgendamento_status_proximoEnvioEm_idx" ON "RelatorioAgendamento"("status", "proximoEnvioEm");

-- CreateIndex
CREATE INDEX "RelatorioDestinatario_email_idx" ON "RelatorioDestinatario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RelatorioDestinatario_agendamentoId_email_key" ON "RelatorioDestinatario"("agendamentoId", "email");

-- CreateIndex
CREATE INDEX "RelatorioExecucao_agendamentoId_iniciadoEm_idx" ON "RelatorioExecucao"("agendamentoId", "iniciadoEm");

-- CreateIndex
CREATE INDEX "RelatorioExecucao_status_iniciadoEm_idx" ON "RelatorioExecucao"("status", "iniciadoEm");

-- AddForeignKey
ALTER TABLE "RelatorioAgendamento" ADD CONSTRAINT "RelatorioAgendamento_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelatorioDestinatario" ADD CONSTRAINT "RelatorioDestinatario_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES "RelatorioAgendamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelatorioExecucao" ADD CONSTRAINT "RelatorioExecucao_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES "RelatorioAgendamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
