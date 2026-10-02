-- Operators such as GM do not manage accounts or number prefixes.
ALTER TABLE `tbl_operator` ADD COLUMN `usesAccounts` BOOLEAN NOT NULL DEFAULT true;

-- A prefix row is a range (650-654), not one number.
ALTER TABLE `number_prefix` ADD COLUMN `rangeStart` VARCHAR(191) NOT NULL DEFAULT '';
ALTER TABLE `number_prefix` ADD COLUMN `rangeEnd` VARCHAR(191) NOT NULL DEFAULT '';
UPDATE `number_prefix` SET `rangeStart` = `prefix`, `rangeEnd` = `prefix`;
ALTER TABLE `number_prefix` DROP COLUMN `prefix`;
ALTER TABLE `number_prefix` ALTER `rangeStart` DROP DEFAULT;
ALTER TABLE `number_prefix` ALTER `rangeEnd` DROP DEFAULT;
CREATE INDEX `number_prefix_rangeStart_idx` ON `number_prefix`(`rangeStart`);

-- Registrations for operators that do not use accounts have no account number.
ALTER TABLE `fleet_registration` MODIFY `accountNo` VARCHAR(191) NULL;
