-- Last memo'd fleet lines, and the phone and account printed on a memo.
CREATE TABLE `tbl_communicatedFleetLine` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fleetRegistrationId` INTEGER NOT NULL,
    `operatorId` INTEGER NOT NULL,
    `operatorAccountId` INTEGER NULL,
    `phoneNumber` VARCHAR(191) NULL,
    `serviceId` INTEGER NOT NULL,
    `amount` DOUBLE NOT NULL,

    INDEX `tbl_communicatedFleetLine_operatorId_idx`(`operatorId`),
    INDEX `tbl_communicatedFleetLine_fleetRegistrationId_idx`(`fleetRegistrationId`),
    UNIQUE INDEX `communicated_fleet_line_key`(`fleetRegistrationId`, `operatorId`, `phoneNumber`, `serviceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `tbl_communicatedFleetLine` ADD CONSTRAINT `tbl_communicatedFleetLine_fleetRegistrationId_fkey` FOREIGN KEY (`fleetRegistrationId`) REFERENCES `tbl_fleetRegistration`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `tbl_communicatedFleetLine` ADD CONSTRAINT `tbl_communicatedFleetLine_operatorId_fkey` FOREIGN KEY (`operatorId`) REFERENCES `tbl_operator`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `tbl_communicatedFleetLine` ADD CONSTRAINT `tbl_communicatedFleetLine_operatorAccountId_fkey` FOREIGN KEY (`operatorAccountId`) REFERENCES `operator_Account`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `tbl_communicatedFleetLine` ADD CONSTRAINT `tbl_communicatedFleetLine_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `tbl_service`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `tbl_communicationBatchLine` ADD COLUMN `phoneNumber` VARCHAR(191) NULL,
    ADD COLUMN `accountNo` VARCHAR(191) NULL;

INSERT INTO `tbl_communicatedFleetLine` (`fleetRegistrationId`, `operatorId`, `operatorAccountId`, `phoneNumber`, `serviceId`, `amount`)
SELECT `fleetRegistrationId`, `operator_id`, `operator_AccountId`, `phoneNumber`, `serviceId`, `amount`
FROM `tbl_fleetRegDetails`;
