/*
  Warnings:

  - You are about to drop the column `desvioMaximo` on the `Sensor` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Sensor" DROP COLUMN "desvioMaximo",
ADD COLUMN     "desvioMaximoTemp" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
ADD COLUMN     "desvioMaximoVibra" DOUBLE PRECISION NOT NULL DEFAULT 5.0;
