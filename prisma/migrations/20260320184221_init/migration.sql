-- CreateTable
CREATE TABLE `Usuario` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `senha` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'TECNICO') NOT NULL DEFAULT 'TECNICO',
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `especialidade` VARCHAR(191) NULL,
    `telefone` VARCHAR(191) NULL,
    `oneSignalId` VARCHAR(191) NULL,
    `atualizadoEm` DATETIME(3) NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Usuario_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Maquina` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(191) NOT NULL,
    `setor` VARCHAR(191) NOT NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `criticidade` ENUM('BAIXA', 'MEDIA', 'ALTA') NOT NULL DEFAULT 'BAIXA',
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `integridade` DOUBLE NOT NULL DEFAULT 100,
    `scoreEstabilidade` DOUBLE NOT NULL DEFAULT 100,
    `previsaoManutencao` DATETIME(3) NULL,
    `janelaManuInicio` DATETIME(3) NULL,
    `janelaManuFim` DATETIME(3) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Sensor` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `maquinaId` INTEGER NOT NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `status` ENUM('ONLINE', 'OFFLINE') NOT NULL DEFAULT 'ONLINE',
    `limiteTemperatura` DOUBLE NOT NULL,
    `idealTemperatura` DOUBLE NOT NULL,
    `limiteVibracao` DOUBLE NOT NULL,
    `idealVibracao` DOUBLE NOT NULL,
    `desvioMaximo` DOUBLE NOT NULL DEFAULT 5.0,
    `ultimaTemperatura` DOUBLE NULL,
    `ultimaVibracao` DOUBLE NULL,
    `ultimaLeituraEm` DATETIME(3) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Leitura` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sensorId` INTEGER NOT NULL,
    `temperatura` DOUBLE NOT NULL,
    `vibracao` DOUBLE NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Leitura_sensorId_criadoEm_idx`(`sensorId`, `criadoEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Alerta` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sensorId` INTEGER NOT NULL,
    `maquinaId` INTEGER NOT NULL,
    `tecnicoId` INTEGER NULL,
    `tipo` ENUM('LIMITE_ULTRAPASSADO', 'TENDENCIA_CURTA', 'TENDENCIA_LONGA', 'DEGRADACAO_ACELERADA', 'INSTABILIDADE') NOT NULL,
    `status` ENUM('ATIVO', 'EM_ANDAMENTO', 'RESOLVIDO', 'CANCELADO') NOT NULL DEFAULT 'ATIVO',
    `mensagem` TEXT NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AlertaEvento` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `alertaId` INTEGER NOT NULL,
    `usuarioId` INTEGER NULL,
    `tipo` ENUM('CRIADO', 'ACEITO', 'ATUALIZADO', 'RESOLVIDO', 'CANCELADO') NOT NULL,
    `descricao` TEXT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Manutencao` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `alertaId` INTEGER NOT NULL,
    `usuarioId` INTEGER NOT NULL,
    `observacao` TEXT NOT NULL,
    `status` ENUM('EM_ANDAMENTO', 'RESOLVIDO') NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RefreshToken` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuarioId` INTEGER NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `RefreshToken_token_key`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Sensor` ADD CONSTRAINT `Sensor_maquinaId_fkey` FOREIGN KEY (`maquinaId`) REFERENCES `Maquina`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Leitura` ADD CONSTRAINT `Leitura_sensorId_fkey` FOREIGN KEY (`sensorId`) REFERENCES `Sensor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Alerta` ADD CONSTRAINT `Alerta_sensorId_fkey` FOREIGN KEY (`sensorId`) REFERENCES `Sensor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Alerta` ADD CONSTRAINT `Alerta_maquinaId_fkey` FOREIGN KEY (`maquinaId`) REFERENCES `Maquina`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Alerta` ADD CONSTRAINT `Alerta_tecnicoId_fkey` FOREIGN KEY (`tecnicoId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AlertaEvento` ADD CONSTRAINT `AlertaEvento_alertaId_fkey` FOREIGN KEY (`alertaId`) REFERENCES `Alerta`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AlertaEvento` ADD CONSTRAINT `AlertaEvento_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Manutencao` ADD CONSTRAINT `Manutencao_alertaId_fkey` FOREIGN KEY (`alertaId`) REFERENCES `Alerta`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Manutencao` ADD CONSTRAINT `Manutencao_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RefreshToken` ADD CONSTRAINT `RefreshToken_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
