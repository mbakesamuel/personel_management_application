/*
  Warnings:

  - A unique constraint covering the columns `[phoneNumber,operator_AccountId,serviceId,amount,effective_date]` on the table `tbl_fleetRegDetails` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `tbl_communicationbatch` DROP FOREIGN KEY `communication_batch_operatorId_fkey`;

-- DropForeignKey
ALTER TABLE `tbl_communicationbatchamount` DROP FOREIGN KEY `communication_batch_amount_lineId_fkey`;

-- DropForeignKey
ALTER TABLE `tbl_communicationbatchamount` DROP FOREIGN KEY `communication_batch_amount_serviceId_fkey`;

-- DropForeignKey
ALTER TABLE `tbl_communicationbatchline` DROP FOREIGN KEY `communication_batch_line_batchId_fkey`;

-- DropForeignKey
ALTER TABLE `tbl_communicationbatchline` DROP FOREIGN KEY `communication_batch_line_fleetRegistrationId_fkey`;

-- DropForeignKey
ALTER TABLE `tbl_dashboardgrouprole` DROP FOREIGN KEY `dashboard_group_role_group_code_fkey`;

-- DropForeignKey
ALTER TABLE `tbl_fleetregdetails` DROP FOREIGN KEY `fleet_reg_details_fleetRegistrationId_fkey`;

-- DropForeignKey
ALTER TABLE `tbl_fleetregdetails` DROP FOREIGN KEY `fleet_reg_details_operator_AccountId_fkey`;

-- DropForeignKey
ALTER TABLE `tbl_fleetregdetails` DROP FOREIGN KEY `fleet_reg_details_operator_id_fkey`;

-- DropForeignKey
ALTER TABLE `tbl_fleetregdetails` DROP FOREIGN KEY `fleet_reg_details_serviceId_fkey`;

-- DropForeignKey
ALTER TABLE `tbl_fleetregistration` DROP FOREIGN KEY `fleet_registration_allowanceId_fkey`;

-- DropForeignKey
ALTER TABLE `tbl_fleetregistration` DROP FOREIGN KEY `fleet_registration_matricule_fkey`;

-- DropForeignKey
ALTER TABLE `tbl_fleetregistration` DROP FOREIGN KEY `fleet_registration_replacedById_fkey`;

-- CreateIndex
CREATE UNIQUE INDEX `tbl_fleetRegDetails_phoneNumber_operator_AccountId_serviceId_key` ON `tbl_fleetRegDetails`(`phoneNumber`, `operator_AccountId`, `serviceId`, `amount`, `effective_date`);

-- AddForeignKey
ALTER TABLE `tbl_fleetRegistration` ADD CONSTRAINT `tbl_fleetRegistration_matricule_fkey` FOREIGN KEY (`matricule`) REFERENCES `tbl_employee`(`matricule`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_fleetRegistration` ADD CONSTRAINT `tbl_fleetRegistration_allowanceId_fkey` FOREIGN KEY (`allowanceId`) REFERENCES `tbl_allowance`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_fleetRegistration` ADD CONSTRAINT `tbl_fleetRegistration_replacedById_fkey` FOREIGN KEY (`replacedById`) REFERENCES `tbl_fleetRegistration`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_fleetRegDetails` ADD CONSTRAINT `tbl_fleetRegDetails_fleetRegistrationId_fkey` FOREIGN KEY (`fleetRegistrationId`) REFERENCES `tbl_fleetRegistration`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_fleetRegDetails` ADD CONSTRAINT `tbl_fleetRegDetails_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `tbl_service`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_fleetRegDetails` ADD CONSTRAINT `tbl_fleetRegDetails_operator_AccountId_fkey` FOREIGN KEY (`operator_AccountId`) REFERENCES `operator_Account`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_fleetRegDetails` ADD CONSTRAINT `tbl_fleetRegDetails_operator_id_fkey` FOREIGN KEY (`operator_id`) REFERENCES `tbl_operator`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_communicationBatch` ADD CONSTRAINT `tbl_communicationBatch_operatorId_fkey` FOREIGN KEY (`operatorId`) REFERENCES `tbl_operator`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_communicationBatchLine` ADD CONSTRAINT `tbl_communicationBatchLine_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `tbl_communicationBatch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_communicationBatchLine` ADD CONSTRAINT `tbl_communicationBatchLine_fleetRegistrationId_fkey` FOREIGN KEY (`fleetRegistrationId`) REFERENCES `tbl_fleetRegistration`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_communicationBatchAmount` ADD CONSTRAINT `tbl_communicationBatchAmount_lineId_fkey` FOREIGN KEY (`lineId`) REFERENCES `tbl_communicationBatchLine`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_communicationBatchAmount` ADD CONSTRAINT `tbl_communicationBatchAmount_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `tbl_service`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_dashboardGroupRole` ADD CONSTRAINT `tbl_dashboardGroupRole_group_code_fkey` FOREIGN KEY (`group_code`) REFERENCES `tbl_dashboardGroup`(`code`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `tbl_communicationbatch` RENAME INDEX `communication_batch_createdAt_idx` TO `tbl_communicationBatch_createdAt_idx`;

-- RenameIndex
ALTER TABLE `tbl_communicationbatch` RENAME INDEX `communication_batch_operatorId_idx` TO `tbl_communicationBatch_operatorId_idx`;

-- RenameIndex
ALTER TABLE `tbl_communicationbatchamount` RENAME INDEX `communication_batch_amount_lineId_idx` TO `tbl_communicationBatchAmount_lineId_idx`;

-- RenameIndex
ALTER TABLE `tbl_communicationbatchamount` RENAME INDEX `communication_batch_amount_serviceId_idx` TO `tbl_communicationBatchAmount_serviceId_idx`;

-- RenameIndex
ALTER TABLE `tbl_communicationbatchline` RENAME INDEX `communication_batch_line_batchId_idx` TO `tbl_communicationBatchLine_batchId_idx`;

-- RenameIndex
ALTER TABLE `tbl_communicationbatchline` RENAME INDEX `communication_batch_line_fleetRegistrationId_idx` TO `tbl_communicationBatchLine_fleetRegistrationId_idx`;

-- RenameIndex
ALTER TABLE `tbl_dashboardgrouprole` RENAME INDEX `dashboard_group_role_group_code_idx` TO `tbl_dashboardGroupRole_group_code_idx`;

-- RenameIndex
ALTER TABLE `tbl_fleetregdetails` RENAME INDEX `fleet_reg_details_fleetRegistrationId_idx` TO `tbl_fleetRegDetails_fleetRegistrationId_idx`;

-- RenameIndex
ALTER TABLE `tbl_fleetregdetails` RENAME INDEX `fleet_reg_details_fleetRegistrationId_serviceId_effective_da_idx` TO `tbl_fleetRegDetails_fleetRegistrationId_serviceId_effective__idx`;

-- RenameIndex
ALTER TABLE `tbl_fleetregdetails` RENAME INDEX `fleet_reg_details_operator_AccountId_idx` TO `tbl_fleetRegDetails_operator_AccountId_idx`;

-- RenameIndex
ALTER TABLE `tbl_fleetregdetails` RENAME INDEX `fleet_reg_details_operator_id_idx` TO `tbl_fleetRegDetails_operator_id_idx`;

-- RenameIndex
ALTER TABLE `tbl_fleetregdetails` RENAME INDEX `fleet_reg_details_serviceId_idx` TO `tbl_fleetRegDetails_serviceId_idx`;

-- RenameIndex
ALTER TABLE `tbl_fleetregistration` RENAME INDEX `fleet_registration_allowanceId_idx` TO `tbl_fleetRegistration_allowanceId_idx`;

-- RenameIndex
ALTER TABLE `tbl_fleetregistration` RENAME INDEX `fleet_registration_createdAt_idx` TO `tbl_fleetRegistration_createdAt_idx`;

-- RenameIndex
ALTER TABLE `tbl_fleetregistration` RENAME INDEX `fleet_registration_isActive_idx` TO `tbl_fleetRegistration_isActive_idx`;

-- RenameIndex
ALTER TABLE `tbl_fleetregistration` RENAME INDEX `fleet_registration_matricule_idx` TO `tbl_fleetRegistration_matricule_idx`;

-- RenameIndex
ALTER TABLE `tbl_fleetregistration` RENAME INDEX `fleet_registration_replacedById_key` TO `tbl_fleetRegistration_replacedById_key`;

-- RenameIndex
ALTER TABLE `tbl_fleetregistration` RENAME INDEX `fleet_registration_updatedAt_idx` TO `tbl_fleetRegistration_updatedAt_idx`;

-- RenameIndex
ALTER TABLE `tbl_service` RENAME INDEX `service_createdAt_idx` TO `tbl_service_createdAt_idx`;

-- RenameIndex
ALTER TABLE `tbl_service` RENAME INDEX `service_name_idx` TO `tbl_service_name_idx`;

-- RenameIndex
ALTER TABLE `tbl_service` RENAME INDEX `service_updatedAt_idx` TO `tbl_service_updatedAt_idx`;
