-- CreateTable
CREATE TABLE `RawNotification` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `postedAt` DATETIME(3) NULL,
    `appPackage` VARCHAR(191) NULL,
    `title` TEXT NULL,
    `body` TEXT NOT NULL,
    `deviceId` VARCHAR(191) NULL,
    `payload` JSON NOT NULL,
    `dedupeHash` VARCHAR(64) NOT NULL,
    `status` ENUM('PENDING', 'PARSED', 'FAILED', 'IGNORED') NOT NULL DEFAULT 'PENDING',
    `matchedRule` VARCHAR(64) NULL,
    `parseError` TEXT NULL,

    UNIQUE INDEX `RawNotification_dedupeHash_key`(`dedupeHash`),
    INDEX `RawNotification_status_receivedAt_idx`(`status`, `receivedAt`),
    INDEX `RawNotification_receivedAt_idx`(`receivedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Trade` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rawNotificationId` INTEGER NULL,
    `source` ENUM('NOTIFICATION', 'MANUAL') NOT NULL DEFAULT 'NOTIFICATION',
    `side` ENUM('BUY', 'SELL') NOT NULL,
    `symbol` VARCHAR(32) NOT NULL,
    `quantity` DECIMAL(18, 4) NOT NULL,
    `price` DECIMAL(18, 6) NOT NULL,
    `fees` DECIMAL(18, 6) NOT NULL DEFAULT 0,
    `netAmount` DECIMAL(20, 6) NOT NULL,
    `currency` VARCHAR(8) NOT NULL DEFAULT 'EGP',
    `executedAt` DATETIME(3) NOT NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Trade_rawNotificationId_key`(`rawNotificationId`),
    INDEX `Trade_symbol_idx`(`symbol`),
    INDEX `Trade_executedAt_idx`(`executedAt`),
    INDEX `Trade_symbol_executedAt_idx`(`symbol`, `executedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Instrument` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(32) NOT NULL,
    `nameAr` VARCHAR(191) NULL,
    `nameEn` VARCHAR(191) NULL,
    `markPrice` DECIMAL(18, 6) NULL,
    `markPriceUpdatedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Instrument_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Trade` ADD CONSTRAINT `Trade_rawNotificationId_fkey` FOREIGN KEY (`rawNotificationId`) REFERENCES `RawNotification`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
