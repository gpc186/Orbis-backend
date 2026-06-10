CREATE TYPE "TipoManutencao" AS ENUM ('CORRETIVA', 'PREVENTIVA');

ALTER TABLE "Manutencao" ADD COLUMN "tipo" "TipoManutencao" NOT NULL DEFAULT 'CORRETIVA';
ALTER TABLE "Manutencao" ADD COLUMN "maquinaId" INTEGER;

UPDATE "Manutencao" AS m
SET "maquinaId" = a."maquinaId"
FROM "Alerta" AS a
WHERE m."alertaId" = a."id";

ALTER TABLE "Manutencao" ALTER COLUMN "maquinaId" SET NOT NULL;

ALTER TABLE "Manutencao" DROP CONSTRAINT "Manutencao_alertaId_fkey";
ALTER TABLE "Manutencao" ALTER COLUMN "alertaId" DROP NOT NULL;

CREATE INDEX "Manutencao_maquinaId_idx" ON "Manutencao"("maquinaId");
CREATE INDEX "Manutencao_tipo_idx" ON "Manutencao"("tipo");

ALTER TABLE "Manutencao" ADD CONSTRAINT "Manutencao_alertaId_fkey" FOREIGN KEY ("alertaId") REFERENCES "Alerta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Manutencao" ADD CONSTRAINT "Manutencao_maquinaId_fkey" FOREIGN KEY ("maquinaId") REFERENCES "Maquina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
