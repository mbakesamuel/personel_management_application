/*
  Warnings:

  - You are about to drop the `absence` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `bank` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `classification` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `diploma` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `division` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `empcontract` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `empdepartureinfo` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `empemploymentdetails` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `empfamilyinfo` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `empidenditifcation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `empinsurance` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `employee` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `employeeclassifications` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `empmaritalstatus` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `empmovement` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `empnextkininfo` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `insurancecentre` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `language` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `maritalstatus` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nationality` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `region` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `religion` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sanction` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sex` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `transfertype` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `workerunion` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `workstatus` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `division` DROP FOREIGN KEY `Division_regionId_fkey`;

-- DropForeignKey
ALTER TABLE `empcontract` DROP FOREIGN KEY `EmpContract_matricule_fkey`;

-- DropForeignKey
ALTER TABLE `empdepartureinfo` DROP FOREIGN KEY `EmpDepartureInfo_matricule_fkey`;

-- DropForeignKey
ALTER TABLE `empemploymentdetails` DROP FOREIGN KEY `EmpEmploymentDetails_matricule_fkey`;

-- DropForeignKey
ALTER TABLE `empfamilyinfo` DROP FOREIGN KEY `EmpFamilyInfo_matricule_fkey`;

-- DropForeignKey
ALTER TABLE `empidenditifcation` DROP FOREIGN KEY `EmpIdenditifcation_matricule_fkey`;

-- DropForeignKey
ALTER TABLE `empinsurance` DROP FOREIGN KEY `EmpInsurance_centre_id_fkey`;

-- DropForeignKey
ALTER TABLE `empinsurance` DROP FOREIGN KEY `EmpInsurance_matricule_fkey`;

-- DropForeignKey
ALTER TABLE `employeeclassifications` DROP FOREIGN KEY `EmployeeClassifications_matricule_fkey`;

-- DropForeignKey
ALTER TABLE `empmaritalstatus` DROP FOREIGN KEY `EmpMaritalStatus_maritalStatusId_fkey`;

-- DropForeignKey
ALTER TABLE `empmaritalstatus` DROP FOREIGN KEY `EmpMaritalStatus_matricule_fkey`;

-- DropForeignKey
ALTER TABLE `empmovement` DROP FOREIGN KEY `EmpMovement_From_unit_id_fkey`;

-- DropForeignKey
ALTER TABLE `empmovement` DROP FOREIGN KEY `EmpMovement_To_unit_id_fkey`;

-- DropForeignKey
ALTER TABLE `empmovement` DROP FOREIGN KEY `EmpMovement_matricule_fkey`;

-- DropForeignKey
ALTER TABLE `empmovement` DROP FOREIGN KEY `EmpMovement_trans_type_id_fkey`;

-- DropForeignKey
ALTER TABLE `empnextkininfo` DROP FOREIGN KEY `EmpNextKinInfo_matricule_fkey`;

-- DropTable
DROP TABLE `absence`;

-- DropTable
DROP TABLE `bank`;

-- DropTable
DROP TABLE `classification`;

-- DropTable
DROP TABLE `diploma`;

-- DropTable
DROP TABLE `division`;

-- DropTable
DROP TABLE `empcontract`;

-- DropTable
DROP TABLE `empdepartureinfo`;

-- DropTable
DROP TABLE `empemploymentdetails`;

-- DropTable
DROP TABLE `empfamilyinfo`;

-- DropTable
DROP TABLE `empidenditifcation`;

-- DropTable
DROP TABLE `empinsurance`;

-- DropTable
DROP TABLE `employee`;

-- DropTable
DROP TABLE `employeeclassifications`;

-- DropTable
DROP TABLE `empmaritalstatus`;

-- DropTable
DROP TABLE `empmovement`;

-- DropTable
DROP TABLE `empnextkininfo`;

-- DropTable
DROP TABLE `insurancecentre`;

-- DropTable
DROP TABLE `language`;

-- DropTable
DROP TABLE `maritalstatus`;

-- DropTable
DROP TABLE `nationality`;

-- DropTable
DROP TABLE `region`;

-- DropTable
DROP TABLE `religion`;

-- DropTable
DROP TABLE `sanction`;

-- DropTable
DROP TABLE `sex`;

-- DropTable
DROP TABLE `transfertype`;

-- DropTable
DROP TABLE `workerunion`;

-- DropTable
DROP TABLE `workstatus`;

-- CreateTable
CREATE TABLE `tbl_employee` (
    `matricule` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `firstname` VARCHAR(191) NULL,
    `dateBirth` DATETIME(3) NOT NULL,
    `placeBirth` VARCHAR(191) NOT NULL,
    `sex` VARCHAR(191) NOT NULL,
    `nationality` VARCHAR(191) NULL,
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

    INDEX `tbl_employee_workflowStatus_idx`(`workflowStatus`),
    PRIMARY KEY (`matricule`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_emp_nat_iden` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `matricule` VARCHAR(191) NOT NULL,
    `idNumber` VARCHAR(191) NOT NULL,
    `date_issue` DATETIME(3) NOT NULL,
    `place_issue` VARCHAR(191) NOT NULL,
    `date_expiry` DATETIME(3) NOT NULL,
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

    INDEX `tbl_emp_nat_iden_matricule_idx`(`matricule`),
    INDEX `tbl_emp_nat_iden_workflowStatus_idx`(`workflowStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_emp_insurance` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `matricule` VARCHAR(191) NOT NULL,
    `ins_number` VARCHAR(191) NULL,
    `centre_id` VARCHAR(191) NOT NULL,
    `reg_date` DATETIME(3) NULL,
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

    INDEX `tbl_emp_insurance_matricule_idx`(`matricule`),
    INDEX `tbl_emp_insurance_workflowStatus_idx`(`workflowStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_emp_marital_status` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `matricule` VARCHAR(191) NOT NULL,
    `maritalStatusId` VARCHAR(191) NOT NULL,
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

    INDEX `tbl_emp_marital_status_matricule_idx`(`matricule`),
    INDEX `tbl_emp_marital_status_workflowStatus_idx`(`workflowStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_emp_employment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `matricule` VARCHAR(191) NOT NULL,
    `dateEng` DATETIME(3) NOT NULL,
    `jobEng` VARCHAR(191) NOT NULL,
    `placeEng` VARCHAR(191) NOT NULL,
    `profession` VARCHAR(191) NULL,
    `workStat` VARCHAR(191) NULL,
    `unit` VARCHAR(191) NULL,
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

    INDEX `tbl_emp_employment_matricule_idx`(`matricule`),
    INDEX `tbl_emp_employment_workflowStatus_idx`(`workflowStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_emp_contract` (
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

    INDEX `tbl_emp_contract_matricule_idx`(`matricule`),
    INDEX `tbl_emp_contract_workflowStatus_idx`(`workflowStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_emp_family` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `matricule` VARCHAR(191) NOT NULL,
    `noSpouses` INTEGER NULL,
    `noChildren` INTEGER NULL,
    `relCode` VARCHAR(191) NULL,
    `effectiveDate` DATETIME(3) NULL,
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

    INDEX `tbl_emp_family_matricule_idx`(`matricule`),
    INDEX `tbl_emp_family_workflowStatus_idx`(`workflowStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_emp_nextkin` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `matricule` VARCHAR(191) NOT NULL,
    `nextKinName` VARCHAR(191) NULL,
    `nextKinRelation` VARCHAR(191) NULL,
    `nextKinAddress` VARCHAR(191) NULL,
    `effectiveDate` DATETIME(3) NOT NULL,
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

    INDEX `tbl_emp_nextkin_matricule_idx`(`matricule`),
    INDEX `tbl_emp_nextkin_workflowStatus_idx`(`workflowStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_emp_departure` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `matricule` VARCHAR(191) NOT NULL,
    `dateDeparture` DATETIME(3) NULL,
    `reasonDeparture` VARCHAR(191) NULL,
    `effectiveDate` DATETIME(3) NOT NULL,
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

    INDEX `tbl_emp_departure_matricule_idx`(`matricule`),
    INDEX `tbl_emp_departure_workflowStatus_idx`(`workflowStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_emp_movement` (
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

    INDEX `tbl_emp_movement_matricule_idx`(`matricule`),
    INDEX `tbl_emp_movement_workflowStatus_idx`(`workflowStatus`),
    INDEX `tbl_emp_movement_From_unit_id_idx`(`From_unit_id`),
    INDEX `tbl_emp_movement_To_unit_id_idx`(`To_unit_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_emp_class` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `matricule` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `echelon` VARCHAR(191) NOT NULL,
    `zone` INTEGER NULL,
    `class_type` VARCHAR(191) NULL,
    `caption` VARCHAR(191) NULL,
    `letter_ref` VARCHAR(191) NULL,
    `letter_date` DATETIME(3) NULL,
    `effective_date` DATETIME(3) NOT NULL,
    `comment` VARCHAR(191) NULL,
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

    INDEX `tbl_emp_class_matricule_idx`(`matricule`),
    INDEX `tbl_emp_class_workflowStatus_idx`(`workflowStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_diploma` (
    `id` VARCHAR(191) NOT NULL,
    `deplomaName` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_region` (
    `id` VARCHAR(191) NOT NULL,
    `religionName` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_division` (
    `id` VARCHAR(191) NOT NULL,
    `divisionName` VARCHAR(191) NOT NULL,
    `regionId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_Language` (
    `id` VARCHAR(191) NOT NULL,
    `language` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_marital_status` (
    `id` VARCHAR(191) NOT NULL,
    `marital_status` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_nationality` (
    `id` VARCHAR(191) NOT NULL,
    `nationality` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_religion` (
    `id` VARCHAR(191) NOT NULL,
    `religionName` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_sanction` (
    `id` VARCHAR(191) NOT NULL,
    `sanctionName` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_Sex` (
    `id` VARCHAR(191) NOT NULL,
    `sexName` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_classification` (
    `id` VARCHAR(191) NOT NULL,
    `class_Name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_worker_union` (
    `id` VARCHAR(191) NOT NULL,
    `unionName` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_work_status` (
    `id` VARCHAR(191) NOT NULL,
    `workStatus` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_transfer_type` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `Type_transfer` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_absence` (
    `id` VARCHAR(191) NOT NULL,
    `absenceType` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_insurance_centre` (
    `id` VARCHAR(191) NOT NULL,
    `centreName` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_bank` (
    `id` VARCHAR(191) NOT NULL,
    `bankName` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `tbl_emp_nat_iden` ADD CONSTRAINT `tbl_emp_nat_iden_matricule_fkey` FOREIGN KEY (`matricule`) REFERENCES `tbl_employee`(`matricule`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_emp_insurance` ADD CONSTRAINT `tbl_emp_insurance_centre_id_fkey` FOREIGN KEY (`centre_id`) REFERENCES `tbl_insurance_centre`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_emp_insurance` ADD CONSTRAINT `tbl_emp_insurance_matricule_fkey` FOREIGN KEY (`matricule`) REFERENCES `tbl_employee`(`matricule`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_emp_marital_status` ADD CONSTRAINT `tbl_emp_marital_status_maritalStatusId_fkey` FOREIGN KEY (`maritalStatusId`) REFERENCES `tbl_marital_status`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_emp_marital_status` ADD CONSTRAINT `tbl_emp_marital_status_matricule_fkey` FOREIGN KEY (`matricule`) REFERENCES `tbl_employee`(`matricule`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_emp_employment` ADD CONSTRAINT `tbl_emp_employment_matricule_fkey` FOREIGN KEY (`matricule`) REFERENCES `tbl_employee`(`matricule`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_emp_contract` ADD CONSTRAINT `tbl_emp_contract_matricule_fkey` FOREIGN KEY (`matricule`) REFERENCES `tbl_employee`(`matricule`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_emp_family` ADD CONSTRAINT `tbl_emp_family_matricule_fkey` FOREIGN KEY (`matricule`) REFERENCES `tbl_employee`(`matricule`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_emp_nextkin` ADD CONSTRAINT `tbl_emp_nextkin_matricule_fkey` FOREIGN KEY (`matricule`) REFERENCES `tbl_employee`(`matricule`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_emp_departure` ADD CONSTRAINT `tbl_emp_departure_matricule_fkey` FOREIGN KEY (`matricule`) REFERENCES `tbl_employee`(`matricule`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_emp_movement` ADD CONSTRAINT `tbl_emp_movement_From_unit_id_fkey` FOREIGN KEY (`From_unit_id`) REFERENCES `tbl_unit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_emp_movement` ADD CONSTRAINT `tbl_emp_movement_To_unit_id_fkey` FOREIGN KEY (`To_unit_id`) REFERENCES `tbl_unit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_emp_movement` ADD CONSTRAINT `tbl_emp_movement_trans_type_id_fkey` FOREIGN KEY (`trans_type_id`) REFERENCES `tbl_transfer_type`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_emp_movement` ADD CONSTRAINT `tbl_emp_movement_matricule_fkey` FOREIGN KEY (`matricule`) REFERENCES `tbl_employee`(`matricule`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_emp_class` ADD CONSTRAINT `tbl_emp_class_matricule_fkey` FOREIGN KEY (`matricule`) REFERENCES `tbl_employee`(`matricule`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_division` ADD CONSTRAINT `tbl_division_regionId_fkey` FOREIGN KEY (`regionId`) REFERENCES `tbl_region`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
