-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'TECNICO');

-- CreateEnum
CREATE TYPE "Criticidade" AS ENUM ('BAIXA', 'MEDIA', 'ALTA');

-- CreateEnum
CREATE TYPE "StatusSensor" AS ENUM ('ONLINE', 'OFFLINE', 'INATIVO');

-- CreateEnum
CREATE TYPE "TipoAlerta" AS ENUM ('LIMITE_ULTRAPASSADO', 'TENDENCIA_CURTA', 'TENDENCIA_LONGA', 'DEGRADACAO_ACELERADA', 'INSTABILIDADE');

-- CreateEnum
CREATE TYPE "StatusAlerta" AS ENUM ('ATIVO', 'EM_ANDAMENTO', 'RESOLVIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TipoEvento" AS ENUM ('CRIADO', 'ACEITO', 'ATUALIZADO', 'RESOLVIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "StatusManutencao" AS ENUM ('EM_ANDAMENTO', 'RESOLVIDO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'TECNICO',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "especialidade" TEXT,
    "telefone" TEXT,
    "oneSignalId" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Maquina" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "setor" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "criticidade" "Criticidade" NOT NULL DEFAULT 'BAIXA',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "integridade" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "scoreEstabilidade" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "previsaoManutencao" TIMESTAMP(3),
    "janelaManuInicio" TIMESTAMP(3),
    "janelaManuFim" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Maquina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sensor" (
    "id" SERIAL NOT NULL,
    "maquinaId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "status" "StatusSensor" NOT NULL DEFAULT 'ONLINE',
    "limiteTemperatura" DOUBLE PRECISION NOT NULL,
    "idealTemperatura" DOUBLE PRECISION NOT NULL,
    "limiteVibracao" DOUBLE PRECISION NOT NULL,
    "idealVibracao" DOUBLE PRECISION NOT NULL,
    "desvioMaximo" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "ultimaTemperatura" DOUBLE PRECISION,
    "ultimaVibracao" DOUBLE PRECISION,
    "ultimaLeituraEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sensor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Leitura" (
    "id" SERIAL NOT NULL,
    "sensorId" INTEGER NOT NULL,
    "temperatura" DOUBLE PRECISION NOT NULL,
    "vibracao" DOUBLE PRECISION NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Leitura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alerta" (
    "id" SERIAL NOT NULL,
    "sensorId" INTEGER NOT NULL,
    "maquinaId" INTEGER NOT NULL,
    "tecnicoId" INTEGER,
    "tipo" "TipoAlerta" NOT NULL,
    "status" "StatusAlerta" NOT NULL DEFAULT 'ATIVO',
    "mensagem" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alerta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertaEvento" (
    "id" SERIAL NOT NULL,
    "alertaId" INTEGER NOT NULL,
    "usuarioId" INTEGER,
    "tipo" "TipoEvento" NOT NULL,
    "descricao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertaEvento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Manutencao" (
    "id" SERIAL NOT NULL,
    "alertaId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "observacao" TEXT NOT NULL,
    "status" "StatusManutencao" NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Manutencao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Leitura_sensorId_criadoEm_idx" ON "Leitura"("sensorId", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- AddForeignKey
ALTER TABLE "Sensor" ADD CONSTRAINT "Sensor_maquinaId_fkey" FOREIGN KEY ("maquinaId") REFERENCES "Maquina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Leitura" ADD CONSTRAINT "Leitura_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "Sensor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alerta" ADD CONSTRAINT "Alerta_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "Sensor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alerta" ADD CONSTRAINT "Alerta_maquinaId_fkey" FOREIGN KEY ("maquinaId") REFERENCES "Maquina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alerta" ADD CONSTRAINT "Alerta_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertaEvento" ADD CONSTRAINT "AlertaEvento_alertaId_fkey" FOREIGN KEY ("alertaId") REFERENCES "Alerta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertaEvento" ADD CONSTRAINT "AlertaEvento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Manutencao" ADD CONSTRAINT "Manutencao_alertaId_fkey" FOREIGN KEY ("alertaId") REFERENCES "Alerta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Manutencao" ADD CONSTRAINT "Manutencao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
