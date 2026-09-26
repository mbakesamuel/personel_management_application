-- CreateTable
CREATE TABLE `Employee` (
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

    INDEX `Employee_workflowStatus_idx`(`workflowStatus`),
    PRIMARY KEY (`matricule`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmpIdenditifcation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `matricule` VARCHAR(191) NOT NULL,
    `idType` VARCHAR(191) NOT NULL,
    `idNumber` VARCHAR(191) NOT NULL,
    `idDate` DATETIME(3) NOT NULL,
    `idPlace` VARCHAR(191) NOT NULL,
    `idValidity` DATETIME(3) NOT NULL,
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

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmpInsurance` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `matricule` VARCHAR(191) NOT NULL,
    `insuranceNo` VARCHAR(191) NULL,
    `centre_id` VARCHAR(191) NOT NULL,
    `RegistrationDate` DATETIME(3) NULL,
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

    INDEX `EmpInsurance_matricule_idx`(`matricule`),
    INDEX `EmpInsurance_workflowStatus_idx`(`workflowStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmpMaritalStatus` (
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

    INDEX `EmpMaritalStatus_matricule_idx`(`matricule`),
    INDEX `EmpMaritalStatus_workflowStatus_idx`(`workflowStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmpEmploymentDetails` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `matricule` VARCHAR(191) NOT NULL,
    `dateEng` DATETIME(3) NOT NULL,
    `jobEng` VARCHAR(191) NOT NULL,
    `placeEng` VARCHAR(191) NOT NULL,
    `profession` VARCHAR(191) NULL,
    `workStat` VARCHAR(191) NULL,
    `unit` VARCHAR(191) NULL,
    `permanent` BOOLEAN NULL,
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

    INDEX `EmpEmploymentDetails_matricule_idx`(`matricule`),
    INDEX `EmpEmploymentDetails_workflowStatus_idx`(`workflowStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmpFamilyInfo` (
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

    INDEX `EmpFamilyInfo_matricule_idx`(`matricule`),
    INDEX `EmpFamilyInfo_workflowStatus_idx`(`workflowStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmpNextKinInfo` (
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

    INDEX `EmpNextKinInfo_matricule_idx`(`matricule`),
    INDEX `EmpNextKinInfo_workflowStatus_idx`(`workflowStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmpDepartureInfo` (
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

    INDEX `EmpDepartureInfo_matricule_idx`(`matricule`),
    INDEX `EmpDepartureInfo_workflowStatus_idx`(`workflowStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmployeeMovements` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `matricule` VARCHAR(191) NOT NULL,
    `DateBegTr` DATETIME(3) NULL,
    `CodeUnit` INTEGER NULL,
    `CodePlace` INTEGER NULL,
    `DateEndTr` DATETIME(3) NULL,
    `Job` VARCHAR(191) NULL,
    `Position` VARCHAR(191) NULL,
    `Place` VARCHAR(191) NULL,
    `Current` BOOLEAN NOT NULL DEFAULT false,
    `Del` BOOLEAN NOT NULL DEFAULT false,
    `TrsType` VARCHAR(191) NULL,
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

    INDEX `EmployeeMovements_matricule_idx`(`matricule`),
    INDEX `EmployeeMovements_workflowStatus_idx`(`workflowStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmployeeClassifications` (
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

    INDEX `EmployeeClassifications_matricule_idx`(`matricule`),
    INDEX `EmployeeClassifications_workflowStatus_idx`(`workflowStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_designation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `designation` VARCHAR(255) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Diploma` (
    `id` VARCHAR(191) NOT NULL,
    `deplomaName` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Region` (
    `id` VARCHAR(191) NOT NULL,
    `religionName` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Division` (
    `id` VARCHAR(191) NOT NULL,
    `divisionName` VARCHAR(191) NOT NULL,
    `regionId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Language` (
    `id` VARCHAR(191) NOT NULL,
    `language` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MaritalStatus` (
    `id` VARCHAR(191) NOT NULL,
    `marital_status` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Nationality` (
    `id` VARCHAR(191) NOT NULL,
    `nationality` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Religion` (
    `id` VARCHAR(191) NOT NULL,
    `religionName` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Sanction` (
    `id` VARCHAR(191) NOT NULL,
    `sanctionName` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Sex` (
    `id` VARCHAR(191) NOT NULL,
    `sexName` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Classification` (
    `id` VARCHAR(191) NOT NULL,
    `class_Name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkerUnion` (
    `id` VARCHAR(191) NOT NULL,
    `unionName` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkStatus` (
    `id` VARCHAR(191) NOT NULL,
    `workStatus` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TransferType` (
    `id` VARCHAR(191) NOT NULL,
    `transferType` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Absence` (
    `id` VARCHAR(191) NOT NULL,
    `absenceType` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InsuranceCentre` (
    `id` VARCHAR(191) NOT NULL,
    `centreName` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Bank` (
    `id` VARCHAR(191) NOT NULL,
    `bankName` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_perfappraisal` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `appyear` INTEGER NULL,
    `matric` VARCHAR(6) NULL,
    `date_lmerit` DATETIME(0) NULL,
    `date_lstat` DATETIME(0) NULL,
    `date_lpro` DATETIME(0) NULL,
    `lengthservice` VARCHAR(255) NULL,
    `pre_cat` VARCHAR(255) NULL,
    `pro_cat` VARCHAR(255) NULL,
    `tbl_award_id` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_salaryreview` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `appyear` INTEGER NULL,
    `matric` VARCHAR(6) NULL,
    `names` VARCHAR(255) NULL,
    `tbl_section_id` DOUBLE NULL,
    `designation` VARCHAR(255) NULL,
    `dateeng` DATETIME(0) NULL,
    `lengthservice` VARCHAR(255) NULL,
    `date_lpro` DATETIME(0) NULL,
    `date_lmer` DATETIME(0) NULL,
    `date_lstat` DATETIME(0) NULL,
    `precat` VARCHAR(255) NULL,
    `procat` VARCHAR(255) NULL,
    `presalary` INTEGER NULL,
    `prosalary` INTEGER NULL,
    `finincmonth` INTEGER NULL,
    `finincyear` INTEGER NULL,
    `award` VARCHAR(255) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_award` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `award` VARCHAR(255) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_scale1` (
    `catid` INTEGER NOT NULL AUTO_INCREMENT,
    `cat` INTEGER NULL,

    PRIMARY KEY (`catid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_scale2` (
    `echid` INTEGER NOT NULL AUTO_INCREMENT,
    `ech` VARCHAR(50) NULL,
    `bsal` INTEGER NOT NULL DEFAULT 0,
    `catid` INTEGER NULL DEFAULT 0,

    INDEX `idx_catid`(`catid`),
    PRIMARY KEY (`echid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_financialyear` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `appyear` INTEGER NOT NULL,
    `closed` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `tbl_financialyear_appyear_key`(`appyear`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(255) NULL,
    `password` VARCHAR(255) NULL,
    `tbl_financialyear_id` INTEGER NULL,
    `role` VARCHAR(30) NOT NULL DEFAULT 'SECRETARY',
    `tbl_group_id` VARCHAR(191) NULL,
    `tbl_section_id` INTEGER NULL,
    `tbl_unit_id` VARCHAR(3) NULL,

    INDEX `tbl_users_tbl_financialyear_id_idx`(`tbl_financialyear_id`),
    INDEX `tbl_users_tbl_group_id_idx`(`tbl_group_id`),
    INDEX `tbl_users_tbl_unit_id_idx`(`tbl_unit_id`),
    INDEX `tbl_users_tbl_section_id_idx`(`tbl_section_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_group` (
    `id` VARCHAR(191) NOT NULL,
    `group_name` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdat` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedat` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_unit` (
    `id` VARCHAR(191) NOT NULL,
    `unit_name` VARCHAR(191) NOT NULL,
    `groupid` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdat` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedat` DATETIME(3) NOT NULL,

    INDEX `unit_groupid_fkey`(`groupid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_section` (
    `id` INTEGER NOT NULL,
    `section` VARCHAR(255) NULL,
    `tbl_unit_id` VARCHAR(3) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,

    INDEX `ecode`(`tbl_unit_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_roles` (
    `code` VARCHAR(30) NOT NULL,
    `label` VARCHAR(120) NOT NULL,
    `jurisdiction` VARCHAR(20) NOT NULL,
    `can_appraisals` BOOLEAN NOT NULL DEFAULT true,
    `can_financial_years` BOOLEAN NOT NULL DEFAULT false,
    `can_organization` BOOLEAN NOT NULL DEFAULT false,
    `can_letter_cc` BOOLEAN NOT NULL DEFAULT false,
    `can_decision_matrix` BOOLEAN NOT NULL DEFAULT false,
    `can_through_officers` BOOLEAN NOT NULL DEFAULT false,
    `can_import_history` BOOLEAN NOT NULL DEFAULT false,
    `can_export_history` BOOLEAN NOT NULL DEFAULT false,
    `can_users` BOOLEAN NOT NULL DEFAULT false,
    `can_roles` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_unit_signatory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tbl_unit_id` VARCHAR(3) NULL,
    `signatory` VARCHAR(255) NULL,
    `title` VARCHAR(255) NULL,
    `effdate` DATETIME(0) NULL,

    INDEX `idx_tbl_estate_id`(`tbl_unit_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_decision_level` (
    `code` VARCHAR(30) NOT NULL,
    `title` VARCHAR(120) NOT NULL,
    `cat_from` INTEGER NOT NULL,
    `cat_to` INTEGER NOT NULL,
    `scope` VARCHAR(10) NOT NULL,

    PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_decision_assignment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `level_code` VARCHAR(30) NOT NULL,
    `signatory` VARCHAR(255) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `tbl_unit_id` VARCHAR(3) NULL,
    `tbl_group_id` VARCHAR(191) NULL,
    `effdate` DATETIME(0) NOT NULL,

    INDEX `tbl_decision_assignment_level_code_idx`(`level_code`),
    INDEX `tbl_decision_assignment_tbl_unit_id_idx`(`tbl_unit_id`),
    INDEX `tbl_decision_assignment_tbl_group_id_idx`(`tbl_group_id`),
    INDEX `tbl_decision_assignment_effdate_idx`(`effdate`),
    UNIQUE INDEX `uniq_decision_unit_effdate`(`level_code`, `tbl_unit_id`, `effdate`),
    UNIQUE INDEX `uniq_decision_group_effdate`(`level_code`, `tbl_group_id`, `effdate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_letter_cc` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `label` VARCHAR(120) NOT NULL,
    `sort_order` INTEGER NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `tbl_letter_cc_label_key`(`label`),
    INDEX `tbl_letter_cc_sort_order_idx`(`sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_unit_letter_cc_hide` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tbl_unit_id` VARCHAR(3) NOT NULL,
    `letter_cc_id` INTEGER NOT NULL,

    INDEX `tbl_unit_letter_cc_hide_tbl_unit_id_idx`(`tbl_unit_id`),
    UNIQUE INDEX `uniq_unit_letter_cc_hide`(`tbl_unit_id`, `letter_cc_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_unit_letter_cc` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tbl_unit_id` VARCHAR(3) NOT NULL,
    `label` VARCHAR(120) NOT NULL,
    `sort_order` INTEGER NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,

    INDEX `tbl_unit_letter_cc_tbl_unit_id_sort_order_idx`(`tbl_unit_id`, `sort_order`),
    UNIQUE INDEX `uniq_unit_letter_cc_label`(`tbl_unit_id`, `label`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_section_thro` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tbl_section_id` INTEGER NOT NULL,
    `signatory` VARCHAR(255) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `effdate` DATETIME(0) NOT NULL,

    INDEX `tbl_section_thro_tbl_section_id_idx`(`tbl_section_id`),
    INDEX `tbl_section_thro_effdate_idx`(`effdate`),
    UNIQUE INDEX `uniq_section_thro_effdate`(`tbl_section_id`, `effdate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EmpIdenditifcation` ADD CONSTRAINT `EmpIdenditifcation_matricule_fkey` FOREIGN KEY (`matricule`) REFERENCES `Employee`(`matricule`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmpInsurance` ADD CONSTRAINT `EmpInsurance_centre_id_fkey` FOREIGN KEY (`centre_id`) REFERENCES `InsuranceCentre`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmpInsurance` ADD CONSTRAINT `EmpInsurance_matricule_fkey` FOREIGN KEY (`matricule`) REFERENCES `Employee`(`matricule`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmpMaritalStatus` ADD CONSTRAINT `EmpMaritalStatus_maritalStatusId_fkey` FOREIGN KEY (`maritalStatusId`) REFERENCES `MaritalStatus`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmpMaritalStatus` ADD CONSTRAINT `EmpMaritalStatus_matricule_fkey` FOREIGN KEY (`matricule`) REFERENCES `Employee`(`matricule`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmpEmploymentDetails` ADD CONSTRAINT `EmpEmploymentDetails_matricule_fkey` FOREIGN KEY (`matricule`) REFERENCES `Employee`(`matricule`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmpFamilyInfo` ADD CONSTRAINT `EmpFamilyInfo_matricule_fkey` FOREIGN KEY (`matricule`) REFERENCES `Employee`(`matricule`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmpNextKinInfo` ADD CONSTRAINT `EmpNextKinInfo_matricule_fkey` FOREIGN KEY (`matricule`) REFERENCES `Employee`(`matricule`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmpDepartureInfo` ADD CONSTRAINT `EmpDepartureInfo_matricule_fkey` FOREIGN KEY (`matricule`) REFERENCES `Employee`(`matricule`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeMovements` ADD CONSTRAINT `EmployeeMovements_matricule_fkey` FOREIGN KEY (`matricule`) REFERENCES `Employee`(`matricule`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeClassifications` ADD CONSTRAINT `EmployeeClassifications_matricule_fkey` FOREIGN KEY (`matricule`) REFERENCES `Employee`(`matricule`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Division` ADD CONSTRAINT `Division_regionId_fkey` FOREIGN KEY (`regionId`) REFERENCES `Region`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_scale2` ADD CONSTRAINT `_24ba9bd7-e161-4baa-80f4-a52528d50bb5_` FOREIGN KEY (`catid`) REFERENCES `tbl_scale1`(`catid`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_users` ADD CONSTRAINT `tbl_users_tbl_financialyear_id_fkey` FOREIGN KEY (`tbl_financialyear_id`) REFERENCES `tbl_financialyear`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_decision_assignment` ADD CONSTRAINT `tbl_decision_assignment_level_code_fkey` FOREIGN KEY (`level_code`) REFERENCES `tbl_decision_level`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_unit_letter_cc_hide` ADD CONSTRAINT `tbl_unit_letter_cc_hide_letter_cc_id_fkey` FOREIGN KEY (`letter_cc_id`) REFERENCES `tbl_letter_cc`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_section_thro` ADD CONSTRAINT `tbl_section_thro_tbl_section_id_fkey` FOREIGN KEY (`tbl_section_id`) REFERENCES `tbl_section`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
