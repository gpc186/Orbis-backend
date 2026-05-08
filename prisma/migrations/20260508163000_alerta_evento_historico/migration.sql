-- AlterEnum
ALTER TYPE "TipoEvento" ADD VALUE 'REABERTO';

-- AlterTable
ALTER TABLE "Alerta" ADD COLUMN "encerradoEm" TIMESTAMP(3),
ADD COLUMN "atualizadoEm" TIMESTAMP(3);

UPDATE "Alerta" SET "atualizadoEm" = CURRENT_TIMESTAMP WHERE "atualizadoEm" IS NULL;

ALTER TABLE "Alerta" ALTER COLUMN "atualizadoEm" SET NOT NULL;

-- AlterTable
ALTER TABLE "AlertaEvento" ADD COLUMN "manutencaoId" INTEGER,
ADD COLUMN "mensagem" TEXT,
ADD COLUMN "statusAnterior" "StatusAlerta",
ADD COLUMN "statusNovo" "StatusAlerta";

-- CreateIndex
CREATE INDEX "AlertaEvento_alertaId_criadoEm_idx" ON "AlertaEvento"("alertaId", "criadoEm");

-- CreateIndex
CREATE INDEX "AlertaEvento_usuarioId_idx" ON "AlertaEvento"("usuarioId");

-- CreateIndex
CREATE INDEX "AlertaEvento_manutencaoId_idx" ON "AlertaEvento"("manutencaoId");

-- AddForeignKey
ALTER TABLE "AlertaEvento" ADD CONSTRAINT "AlertaEvento_manutencaoId_fkey" FOREIGN KEY ("manutencaoId") REFERENCES "Manutencao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
