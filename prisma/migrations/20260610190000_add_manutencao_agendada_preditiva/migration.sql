ALTER TYPE "StatusManutencao" ADD VALUE IF NOT EXISTS 'AGENDADA';
ALTER TYPE "StatusManutencao" ADD VALUE IF NOT EXISTS 'CANCELADA';

CREATE TYPE "PrioridadeManutencao" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'URGENTE');
CREATE TYPE "OrigemManutencao" AS ENUM ('MANUAL', 'ALERTA', 'PREDICAO');
CREATE TYPE "CumprimentoAgendamento" AS ENUM ('ANTECIPADA', 'NO_PRAZO', 'ATRASADA', 'NAO_APLICAVEL');

ALTER TABLE "Manutencao" ADD COLUMN "titulo" TEXT;
ALTER TABLE "Manutencao" ADD COLUMN "prioridade" "PrioridadeManutencao" NOT NULL DEFAULT 'MEDIA';
ALTER TABLE "Manutencao" ADD COLUMN "origem" "OrigemManutencao" NOT NULL DEFAULT 'ALERTA';
ALTER TABLE "Manutencao" ADD COLUMN "dataAgendada" TIMESTAMP(3);
ALTER TABLE "Manutencao" ADD COLUMN "janelaAgendadaInicio" TIMESTAMP(3);
ALTER TABLE "Manutencao" ADD COLUMN "janelaAgendadaFim" TIMESTAMP(3);
ALTER TABLE "Manutencao" ADD COLUMN "concluidaEm" TIMESTAMP(3);
ALTER TABLE "Manutencao" ADD COLUMN "cumprimentoAgendamento" "CumprimentoAgendamento" NOT NULL DEFAULT 'NAO_APLICAVEL';
ALTER TABLE "Manutencao" ADD COLUMN "metadataPredicao" JSONB;

UPDATE "Manutencao" AS m
SET
  "titulo" = CASE
    WHEN m."tipo" = 'PREVENTIVA' THEN CONCAT('Manutencao preventiva - ', COALESCE(ma."nome", CONCAT('Maquina ', m."maquinaId")))
    ELSE CONCAT('Manutencao corretiva - ', COALESCE(ma."nome", CONCAT('Maquina ', m."maquinaId")))
  END,
  "origem" = CASE
    WHEN m."tipo" = 'PREVENTIVA' THEN 'MANUAL'::"OrigemManutencao"
    ELSE 'ALERTA'::"OrigemManutencao"
  END,
  "concluidaEm" = CASE
    WHEN m."status" IN ('RESOLVIDO', 'ENCERRADO_SEM_SOLUCAO') THEN m."criadoEm"
    ELSE NULL
  END
FROM "Maquina" AS ma
WHERE m."maquinaId" = ma."id";

UPDATE "Manutencao"
SET "titulo" = CASE
  WHEN "tipo" = 'PREVENTIVA' THEN CONCAT('Manutencao preventiva - Maquina ', "maquinaId")
  ELSE CONCAT('Manutencao corretiva - Maquina ', "maquinaId")
END
WHERE "titulo" IS NULL;

ALTER TABLE "Manutencao" ALTER COLUMN "titulo" SET NOT NULL;
ALTER TABLE "Manutencao" ALTER COLUMN "usuarioId" DROP NOT NULL;

CREATE INDEX "Manutencao_status_idx" ON "Manutencao"("status");
CREATE INDEX "Manutencao_origem_idx" ON "Manutencao"("origem");
CREATE INDEX "Manutencao_dataAgendada_idx" ON "Manutencao"("dataAgendada");
