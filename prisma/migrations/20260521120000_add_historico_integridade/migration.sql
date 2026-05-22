-- CreateTable
CREATE TABLE "HistoricoIntegridade" (
    "id" SERIAL NOT NULL,
    "maquinaId" INTEGER NOT NULL,
    "integridade" DOUBLE PRECISION NOT NULL,
    "scoreEstabilidade" DOUBLE PRECISION,
    "origem" TEXT,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricoIntegridade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HistoricoIntegridade_maquinaId_criadoEm_idx" ON "HistoricoIntegridade"("maquinaId", "criadoEm");

-- CreateIndex
CREATE INDEX "HistoricoIntegridade_criadoEm_idx" ON "HistoricoIntegridade"("criadoEm");

-- AddForeignKey
ALTER TABLE "HistoricoIntegridade" ADD CONSTRAINT "HistoricoIntegridade_maquinaId_fkey" FOREIGN KEY ("maquinaId") REFERENCES "Maquina"("id") ON DELETE CASCADE ON UPDATE CASCADE;
