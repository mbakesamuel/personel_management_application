-- Move operator, phone, and account onto each registration detail, then rename tables.
ALTER TABLE `fleet_reg_details`
  ADD COLUMN `phoneNumber` VARCHAR(191) NULL,
  ADD COLUMN `operator_id` INTEGER NULL,
  ADD COLUMN `operator_AccountId` INTEGER NULL;

UPDATE `fleet_reg_details` AS detail
INNER JOIN `fleet_registration` AS registration
  ON registration.`id` = detail.`fleetRegistrationId`
SET
  detail.`phoneNumber` = registration.`phoneNumber`,
  detail.`operator_id` = registration.`operator_id`,
  detail.`operator_AccountId` = registration.`operator_AccountId`;

ALTER TABLE `fleet_reg_details`
  MODIFY `operator_id` INTEGER NOT NULL;

CREATE INDEX `fleet_reg_details_operator_id_idx` ON `fleet_reg_details`(`operator_id`);
CREATE INDEX `fleet_reg_details_operator_AccountId_idx` ON `fleet_reg_details`(`operator_AccountId`);

ALTER TABLE `fleet_reg_details`
  ADD CONSTRAINT `fleet_reg_details_operator_id_fkey` FOREIGN KEY (`operator_id`) REFERENCES `tbl_operator`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fleet_reg_details_operator_AccountId_fkey` FOREIGN KEY (`operator_AccountId`) REFERENCES `operator_Account`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `fleet_registration` DROP FOREIGN KEY `fleet_registration_operator_id_fkey`;
ALTER TABLE `fleet_registration` DROP FOREIGN KEY `fleet_registration_operator_AccountId_fkey`;
ALTER TABLE `fleet_registration` DROP INDEX `fleet_registration_operator_AccountId_idx`;
ALTER TABLE `fleet_registration`
  DROP COLUMN `operator_id`,
  DROP COLUMN `operator_AccountId`,
  DROP COLUMN `phoneNumber`;

RENAME TABLE
  `fleet_registration` TO `tbl_fleetRegistration`,
  `fleet_reg_details` TO `tbl_fleetRegDetails`,
  `service` TO `tbl_service`,
  `communication_batch` TO `tbl_communicationBatch`,
  `communication_batch_line` TO `tbl_communicationBatchLine`,
  `communication_batch_amount` TO `tbl_communicationBatchAmount`,
  `dashboard_group` TO `tbl_dashboardGroup`,
  `dashboard_group_role` TO `tbl_dashboardGroupRole`;
