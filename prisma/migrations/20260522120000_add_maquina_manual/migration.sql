CREATE TABLE "MaquinaManual" (
    "id" SERIAL NOT NULL,
    "maquinaId" INTEGER NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "caminho" TEXT NOT NULL,
    "textoExtraido" TEXT NOT NULL,
    "embedding" JSONB,
    "chunks" JSONB,
    "especificacoes" JSONB,
    "modeloEmbedding" TEXT,
    "modeloAnalise" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaquinaManual_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MaquinaManual_maquinaId_key" ON "MaquinaManual"("maquinaId");
CREATE INDEX "MaquinaManual_criadoEm_idx" ON "MaquinaManual"("criadoEm");

ALTER TABLE "MaquinaManual"
ADD CONSTRAINT "MaquinaManual_maquinaId_fkey"
FOREIGN KEY ("maquinaId") REFERENCES "Maquina"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
