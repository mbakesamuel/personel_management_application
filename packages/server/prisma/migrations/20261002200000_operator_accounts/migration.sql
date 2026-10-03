-- CreateTable
CREATE TABLE `operator_Account` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `operator_id` INTEGER NOT NULL,
    `accountNo` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `operator_Account_operator_id_idx`(`operator_id`),
    UNIQUE INDEX `operator_Account_operator_id_accountNo_key`(`operator_id`, `accountNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Copy existing registration account numbers onto the operator.
INSERT INTO `operator_Account` (`operator_id`, `accountNo`, `updatedAt`)
SELECT `operator_id`, TRIM(`accountNo`), CURRENT_TIMESTAMP(3)
FROM `fleet_registration`
WHERE `accountNo` IS NOT NULL AND TRIM(`accountNo`) <> ''
GROUP BY `operator_id`, TRIM(`accountNo`);

-- AlterTable
ALTER TABLE `fleet_registration` ADD COLUMN `operator_AccountId` INTEGER NULL;

UPDATE `fleet_registration` AS registration
INNER JOIN `operator_Account` AS account
  ON account.`operator_id` = registration.`operator_id`
 AND account.`accountNo` = TRIM(registration.`accountNo`)
SET registration.`operator_AccountId` = account.`id`
WHERE registration.`accountNo` IS NOT NULL AND TRIM(registration.`accountNo`) <> '';

ALTER TABLE `fleet_registration` DROP COLUMN `accountNo`,
    MODIFY `phoneNumber` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `fleet_registration_operator_AccountId_idx` ON `fleet_registration`(`operator_AccountId`);

-- AddForeignKey
ALTER TABLE `operator_Account` ADD CONSTRAINT `operator_Account_operator_id_fkey` FOREIGN KEY (`operator_id`) REFERENCES `tbl_operator`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fleet_registration` ADD CONSTRAINT `fleet_registration_operator_AccountId_fkey` FOREIGN KEY (`operator_AccountId`) REFERENCES `operator_Account`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
