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

-- Foreign keys and indexes keep their old names across RENAME TABLE.
-- Recreate them with the mapped names. Linux treats these names as case-sensitive.
ALTER TABLE `tbl_communicationBatch` DROP FOREIGN KEY `communication_batch_operatorId_fkey`;
ALTER TABLE `tbl_communicationBatchAmount` DROP FOREIGN KEY `communication_batch_amount_lineId_fkey`;
ALTER TABLE `tbl_communicationBatchAmount` DROP FOREIGN KEY `communication_batch_amount_serviceId_fkey`;
ALTER TABLE `tbl_communicationBatchLine` DROP FOREIGN KEY `communication_batch_line_batchId_fkey`;
ALTER TABLE `tbl_communicationBatchLine` DROP FOREIGN KEY `communication_batch_line_fleetRegistrationId_fkey`;
ALTER TABLE `tbl_dashboardGroupRole` DROP FOREIGN KEY `dashboard_group_role_group_code_fkey`;
ALTER TABLE `tbl_fleetRegDetails` DROP FOREIGN KEY `fleet_reg_details_fleetRegistrationId_fkey`;
ALTER TABLE `tbl_fleetRegDetails` DROP FOREIGN KEY `fleet_reg_details_operator_AccountId_fkey`;
ALTER TABLE `tbl_fleetRegDetails` DROP FOREIGN KEY `fleet_reg_details_operator_id_fkey`;
ALTER TABLE `tbl_fleetRegDetails` DROP FOREIGN KEY `fleet_reg_details_serviceId_fkey`;
ALTER TABLE `tbl_fleetRegistration` DROP FOREIGN KEY `fleet_registration_allowanceId_fkey`;
ALTER TABLE `tbl_fleetRegistration` DROP FOREIGN KEY `fleet_registration_matricule_fkey`;
ALTER TABLE `tbl_fleetRegistration` DROP FOREIGN KEY `fleet_registration_replacedById_fkey`;

ALTER TABLE `tbl_fleetRegistration` ADD CONSTRAINT `tbl_fleetRegistration_matricule_fkey` FOREIGN KEY (`matricule`) REFERENCES `tbl_employee`(`matricule`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `tbl_fleetRegistration` ADD CONSTRAINT `tbl_fleetRegistration_allowanceId_fkey` FOREIGN KEY (`allowanceId`) REFERENCES `tbl_allowance`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `tbl_fleetRegistration` ADD CONSTRAINT `tbl_fleetRegistration_replacedById_fkey` FOREIGN KEY (`replacedById`) REFERENCES `tbl_fleetRegistration`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `tbl_fleetRegDetails` ADD CONSTRAINT `tbl_fleetRegDetails_fleetRegistrationId_fkey` FOREIGN KEY (`fleetRegistrationId`) REFERENCES `tbl_fleetRegistration`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `tbl_fleetRegDetails` ADD CONSTRAINT `tbl_fleetRegDetails_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `tbl_service`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `tbl_fleetRegDetails` ADD CONSTRAINT `tbl_fleetRegDetails_operator_AccountId_fkey` FOREIGN KEY (`operator_AccountId`) REFERENCES `operator_Account`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `tbl_fleetRegDetails` ADD CONSTRAINT `tbl_fleetRegDetails_operator_id_fkey` FOREIGN KEY (`operator_id`) REFERENCES `tbl_operator`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `tbl_communicationBatch` ADD CONSTRAINT `tbl_communicationBatch_operatorId_fkey` FOREIGN KEY (`operatorId`) REFERENCES `tbl_operator`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `tbl_communicationBatchLine` ADD CONSTRAINT `tbl_communicationBatchLine_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `tbl_communicationBatch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `tbl_communicationBatchLine` ADD CONSTRAINT `tbl_communicationBatchLine_fleetRegistrationId_fkey` FOREIGN KEY (`fleetRegistrationId`) REFERENCES `tbl_fleetRegistration`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `tbl_communicationBatchAmount` ADD CONSTRAINT `tbl_communicationBatchAmount_lineId_fkey` FOREIGN KEY (`lineId`) REFERENCES `tbl_communicationBatchLine`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `tbl_communicationBatchAmount` ADD CONSTRAINT `tbl_communicationBatchAmount_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `tbl_service`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `tbl_dashboardGroupRole` ADD CONSTRAINT `tbl_dashboardGroupRole_group_code_fkey` FOREIGN KEY (`group_code`) REFERENCES `tbl_dashboardGroup`(`code`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `tbl_communicationBatch` RENAME INDEX `communication_batch_createdAt_idx` TO `tbl_communicationBatch_createdAt_idx`;
ALTER TABLE `tbl_communicationBatch` RENAME INDEX `communication_batch_operatorId_idx` TO `tbl_communicationBatch_operatorId_idx`;
ALTER TABLE `tbl_communicationBatchAmount` RENAME INDEX `communication_batch_amount_lineId_idx` TO `tbl_communicationBatchAmount_lineId_idx`;
ALTER TABLE `tbl_communicationBatchAmount` RENAME INDEX `communication_batch_amount_serviceId_idx` TO `tbl_communicationBatchAmount_serviceId_idx`;
ALTER TABLE `tbl_communicationBatchLine` RENAME INDEX `communication_batch_line_batchId_idx` TO `tbl_communicationBatchLine_batchId_idx`;
ALTER TABLE `tbl_communicationBatchLine` RENAME INDEX `communication_batch_line_fleetRegistrationId_idx` TO `tbl_communicationBatchLine_fleetRegistrationId_idx`;
ALTER TABLE `tbl_dashboardGroupRole` RENAME INDEX `dashboard_group_role_group_code_idx` TO `tbl_dashboardGroupRole_group_code_idx`;
ALTER TABLE `tbl_fleetRegDetails` RENAME INDEX `fleet_reg_details_fleetRegistrationId_idx` TO `tbl_fleetRegDetails_fleetRegistrationId_idx`;
ALTER TABLE `tbl_fleetRegDetails` RENAME INDEX `fleet_reg_details_fleetRegistrationId_serviceId_effective_da_idx` TO `tbl_fleetRegDetails_fleetRegistrationId_serviceId_effective__idx`;
ALTER TABLE `tbl_fleetRegDetails` RENAME INDEX `fleet_reg_details_operator_AccountId_idx` TO `tbl_fleetRegDetails_operator_AccountId_idx`;
ALTER TABLE `tbl_fleetRegDetails` RENAME INDEX `fleet_reg_details_operator_id_idx` TO `tbl_fleetRegDetails_operator_id_idx`;
ALTER TABLE `tbl_fleetRegDetails` RENAME INDEX `fleet_reg_details_serviceId_idx` TO `tbl_fleetRegDetails_serviceId_idx`;
ALTER TABLE `tbl_fleetRegistration` RENAME INDEX `fleet_registration_allowanceId_idx` TO `tbl_fleetRegistration_allowanceId_idx`;
ALTER TABLE `tbl_fleetRegistration` RENAME INDEX `fleet_registration_createdAt_idx` TO `tbl_fleetRegistration_createdAt_idx`;
ALTER TABLE `tbl_fleetRegistration` RENAME INDEX `fleet_registration_isActive_idx` TO `tbl_fleetRegistration_isActive_idx`;
ALTER TABLE `tbl_fleetRegistration` RENAME INDEX `fleet_registration_matricule_idx` TO `tbl_fleetRegistration_matricule_idx`;
ALTER TABLE `tbl_fleetRegistration` RENAME INDEX `fleet_registration_replacedById_key` TO `tbl_fleetRegistration_replacedById_key`;
ALTER TABLE `tbl_fleetRegistration` RENAME INDEX `fleet_registration_updatedAt_idx` TO `tbl_fleetRegistration_updatedAt_idx`;
ALTER TABLE `tbl_service` RENAME INDEX `service_createdAt_idx` TO `tbl_service_createdAt_idx`;
ALTER TABLE `tbl_service` RENAME INDEX `service_name_idx` TO `tbl_service_name_idx`;
ALTER TABLE `tbl_service` RENAME INDEX `service_updatedAt_idx` TO `tbl_service_updatedAt_idx`;
