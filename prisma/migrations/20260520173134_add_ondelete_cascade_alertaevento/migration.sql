-- DropForeignKey
ALTER TABLE "AlertaEvento" DROP CONSTRAINT "AlertaEvento_alertaId_fkey";

-- AddForeignKey
ALTER TABLE "AlertaEvento" ADD CONSTRAINT "AlertaEvento_alertaId_fkey" FOREIGN KEY ("alertaId") REFERENCES "Alerta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
