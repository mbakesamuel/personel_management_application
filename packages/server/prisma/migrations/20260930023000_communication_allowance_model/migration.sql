-- Operator membership keeps the line and the join/leave dates.
-- Airtime and Data amounts live in fleet_reg_details, one row per change.

-- AlterTable
ALTER TABLE `fleet_registration` DROP COLUMN `amount`,
    ADD COLUMN `allowanceId` VARCHAR(191) NOT NULL,
    ADD COLUMN `replacedById` INTEGER NULL,
    MODIFY `end_date` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `service` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `service_name_idx`(`name`),
    INDEX `service_createdAt_idx`(`createdAt`),
    INDEX `service_updatedAt_idx`(`updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fleet_reg_details` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fleetRegistrationId` INTEGER NOT NULL,
    `serviceId` INTEGER NOT NULL,
    `amount` DOUBLE NOT NULL,
    `effective_date` DATETIME(3) NOT NULL,

    INDEX `fleet_reg_details_fleetRegistrationId_idx`(`fleetRegistrationId`),
    INDEX `fleet_reg_details_serviceId_idx`(`serviceId`),
    INDEX `fleet_reg_details_fleetRegistrationId_serviceId_effective_da_idx`(`fleetRegistrationId`, `serviceId`, `effective_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `fleet_registration_replacedById_key` ON `fleet_registration`(`replacedById`);

-- CreateIndex
CREATE INDEX `fleet_registration_allowanceId_idx` ON `fleet_registration`(`allowanceId`);

-- AddForeignKey
ALTER TABLE `fleet_registration` ADD CONSTRAINT `fleet_registration_allowanceId_fkey` FOREIGN KEY (`allowanceId`) REFERENCES `tbl_allowance`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fleet_registration` ADD CONSTRAINT `fleet_registration_replacedById_fkey` FOREIGN KEY (`replacedById`) REFERENCES `fleet_registration`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fleet_reg_details` ADD CONSTRAINT `fleet_reg_details_fleetRegistrationId_fkey` FOREIGN KEY (`fleetRegistrationId`) REFERENCES `fleet_registration`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fleet_reg_details` ADD CONSTRAINT `fleet_reg_details_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `service`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO `service` (`name`, `updatedAt`) VALUES
    ('Airtime', CURRENT_TIMESTAMP(3)),
    ('Data', CURRENT_TIMESTAMP(3));
