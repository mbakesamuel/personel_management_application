-- Stored operator batches for communication allowance changes.
CREATE TABLE `communication_batch` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `operatorId` INTEGER NOT NULL,
    `effective_date` DATETIME(3) NOT NULL,
    `end_date` DATETIME(3) NOT NULL,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `communication_batch_operatorId_idx`(`operatorId`),
    INDEX `communication_batch_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `communication_batch_line` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `batchId` INTEGER NOT NULL,
    `fleetRegistrationId` INTEGER NOT NULL,
    `action` VARCHAR(20) NOT NULL,

    INDEX `communication_batch_line_batchId_idx`(`batchId`),
    INDEX `communication_batch_line_fleetRegistrationId_idx`(`fleetRegistrationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `communication_batch_amount` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lineId` INTEGER NOT NULL,
    `serviceId` INTEGER NOT NULL,
    `previousAmount` DOUBLE NULL,
    `amount` DOUBLE NOT NULL,

    INDEX `communication_batch_amount_lineId_idx`(`lineId`),
    INDEX `communication_batch_amount_serviceId_idx`(`serviceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `communication_batch` ADD CONSTRAINT `communication_batch_operatorId_fkey` FOREIGN KEY (`operatorId`) REFERENCES `tbl_operator`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `communication_batch_line` ADD CONSTRAINT `communication_batch_line_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `communication_batch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `communication_batch_line` ADD CONSTRAINT `communication_batch_line_fleetRegistrationId_fkey` FOREIGN KEY (`fleetRegistrationId`) REFERENCES `fleet_registration`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `communication_batch_amount` ADD CONSTRAINT `communication_batch_amount_lineId_fkey` FOREIGN KEY (`lineId`) REFERENCES `communication_batch_line`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `communication_batch_amount` ADD CONSTRAINT `communication_batch_amount_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `service`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
