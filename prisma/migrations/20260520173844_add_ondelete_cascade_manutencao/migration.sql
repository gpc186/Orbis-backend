-- DropForeignKey
ALTER TABLE "Manutencao" DROP CONSTRAINT "Manutencao_alertaId_fkey";

-- AddForeignKey
ALTER TABLE "Manutencao" ADD CONSTRAINT "Manutencao_alertaId_fkey" FOREIGN KEY ("alertaId") REFERENCES "Alerta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
