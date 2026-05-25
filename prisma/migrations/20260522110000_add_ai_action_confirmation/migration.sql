-- CreateEnum
CREATE TYPE "StatusAiActionConfirmation" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "AiActionConfirmation" (
    "id" TEXT NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "actionName" TEXT NOT NULL,
    "actionData" JSONB NOT NULL,
    "actionLabel" TEXT NOT NULL,
    "summary" JSONB,
    "status" "StatusAiActionConfirmation" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "AiActionConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiActionConfirmation_usuarioId_status_expiresAt_idx" ON "AiActionConfirmation"("usuarioId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "AiActionConfirmation_status_expiresAt_idx" ON "AiActionConfirmation"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "AiActionConfirmation" ADD CONSTRAINT "AiActionConfirmation_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
