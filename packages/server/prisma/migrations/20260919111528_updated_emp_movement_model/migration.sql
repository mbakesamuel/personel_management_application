/*
  Warnings:

  - You are about to drop the column `effectiveDate` on the `empemploymentdetails` table. All the data in the column will be lost.
  - You are about to drop the column `permanent` on the `empemploymentdetails` table. All the data in the column will be lost.
  - The primary key for the `transfertype` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `transferType` on the `transfertype` table. All the data in the column will be lost.
  - You are about to alter the column `id` on the `transfertype` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Int`.
  - You are about to drop the `employeemovements` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `Type_transfer` to the `TransferType` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `employeemovements` DROP FOREIGN KEY `EmployeeMovements_matricule_fkey`;

-- AlterTable
ALTER TABLE `empemploymentdetails` DROP COLUMN `effectiveDate`,
    DROP COLUMN `permanent`;

-- AlterTable
ALTER TABLE `transfertype` DROP PRIMARY KEY,
    DROP COLUMN `transferType`,
    ADD COLUMN `Type_transfer` VARCHAR(191) NOT NULL,
    MODIFY `id` INTEGER NOT NULL AUTO_INCREMENT,
    ADD PRIMARY KEY (`id`);

-- DropTable
DROP TABLE `employeemovements`;

-- CreateTable
CREATE TABLE `EmpContract` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `matricule` VARCHAR(191) NOT NULL,
    `contractType` ENUM('SPECIFIED', 'UNSPECIFIED') NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NULL,
    `workflowStatus` ENUM('PENDING', 'VALIDATED', 'REJECTED', 'SUPERSEDED') NOT NULL DEFAULT 'PENDING',
    `current` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdById` INTEGER NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `updatedById` INTEGER NULL,
    `validatedAt` DATETIME(3) NULL,
    `validatedById` INTEGER NULL,
    `rejectedAt` DATETIME(3) NULL,
    `rejectedById` INTEGER NULL,
    `reviewNote` VARCHAR(191) NULL,

    INDEX `EmpContract_matricule_idx`(`matricule`),
    INDEX `EmpContract_workflowStatus_idx`(`workflowStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmpMovement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `matricule` VARCHAR(191) NOT NULL,
    `Eff_date` DATETIME(3) NULL,
    `From_unit_id` VARCHAR(191) NULL,
    `To_unit_id` VARCHAR(191) NULL,
    `Position` VARCHAR(191) NULL,
    `trans_type_id` INTEGER NOT NULL,
    `workflowStatus` ENUM('PENDING', 'VALIDATED', 'REJECTED', 'SUPERSEDED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdById` INTEGER NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `updatedById` INTEGER NULL,
    `validatedAt` DATETIME(3) NULL,
    `validatedById` INTEGER NULL,
    `rejectedAt` DATETIME(3) NULL,
    `rejectedById` INTEGER NULL,
    `reviewNote` VARCHAR(191) NULL,

    INDEX `EmpMovement_matricule_idx`(`matricule`),
    INDEX `EmpMovement_workflowStatus_idx`(`workflowStatus`),
    INDEX `EmpMovement_From_unit_id_idx`(`From_unit_id`),
    INDEX `EmpMovement_To_unit_id_idx`(`To_unit_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EmpContract` ADD CONSTRAINT `EmpContract_matricule_fkey` FOREIGN KEY (`matricule`) REFERENCES `Employee`(`matricule`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmpMovement` ADD CONSTRAINT `EmpMovement_From_unit_id_fkey` FOREIGN KEY (`From_unit_id`) REFERENCES `tbl_unit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmpMovement` ADD CONSTRAINT `EmpMovement_To_unit_id_fkey` FOREIGN KEY (`To_unit_id`) REFERENCES `tbl_unit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmpMovement` ADD CONSTRAINT `EmpMovement_trans_type_id_fkey` FOREIGN KEY (`trans_type_id`) REFERENCES `TransferType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmpMovement` ADD CONSTRAINT `EmpMovement_matricule_fkey` FOREIGN KEY (`matricule`) REFERENCES `Employee`(`matricule`) ON DELETE RESTRICT ON UPDATE CASCADE;
