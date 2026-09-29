-- CreateTable
CREATE TABLE `tbl_employee` (
    `matricule` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `firstname` VARCHAR(191) NULL,
    `dateBirth` DATETIME(3) NOT NULL,
    `placeBirth` VARCHAR(191) NOT NULL,
    `sex` VARCHAR(191) NOT NULL,
    `nationality` VARCHAR(191) NULL,
    `maritalStatus` VARCHAR(191) NULL,
    `wives` INTEGER NOT NULL DEFAULT 0,
    `noChildren` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `currentUnitId` VARCHAR(191) NULL,
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
    INDEX `tbl_employee_currentUnitId_idx`(`currentUnitId`),
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
    `employmentId` INTEGER NOT NULL,
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

    INDEX `tbl_emp_contract_employmentId_idx`(`employmentId`),
    INDEX `tbl_emp_contract_workflowStatus_idx`(`workflowStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_emp_family_member` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `matricule` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `relationship` ENUM('SPOUSE', 'CHILD') NOT NULL,
    `dateOfBirth` DATETIME(3) NOT NULL,
    `effectiveDate` DATETIME(3) NOT NULL,
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

    INDEX `tbl_emp_family_member_matricule_idx`(`matricule`),
    INDEX `tbl_emp_family_member_workflowStatus_idx`(`workflowStatus`),
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
    `departureId` INTEGER NOT NULL,
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
    INDEX `tbl_emp_departure_departureId_idx`(`departureId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_departure` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type_departure` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

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
CREATE TABLE `tbl_designation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `designation` VARCHAR(255) NULL,

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
CREATE TABLE `tbl_language` (
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
CREATE TABLE `tbl_sex` (
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
    `mustChangePassword` BOOLEAN NOT NULL DEFAULT false,
    `tbl_financialyear_id` INTEGER NULL,
    `role` VARCHAR(30) NOT NULL DEFAULT 'SECRETARY',
    `tbl_group_id` VARCHAR(191) NULL,
    `tbl_zone_id` VARCHAR(191) NULL,
    `tbl_section_id` INTEGER NULL,
    `tbl_unit_id` VARCHAR(3) NULL,

    INDEX `tbl_users_tbl_financialyear_id_idx`(`tbl_financialyear_id`),
    INDEX `tbl_users_tbl_group_id_idx`(`tbl_group_id`),
    INDEX `tbl_users_tbl_zone_id_idx`(`tbl_zone_id`),
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
CREATE TABLE `tbl_zone` (
    `id` VARCHAR(191) NOT NULL,
    `zone_name` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdat` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedat` DATETIME(3) NOT NULL,

    INDEX `tbl_zone_groupId_idx`(`groupId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_unit` (
    `id` VARCHAR(191) NOT NULL,
    `unit_name` VARCHAR(191) NOT NULL,
    `groupid` VARCHAR(191) NOT NULL,
    `zoneId` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdat` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedat` DATETIME(3) NOT NULL,

    INDEX `unit_groupid_fkey`(`groupid`),
    INDEX `tbl_unit_zoneId_idx`(`zoneId`),
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
CREATE TABLE `tbl_jurisdiction` (
    `code` VARCHAR(30) NOT NULL,
    `label` VARCHAR(120) NOT NULL,
    `rank` INTEGER NOT NULL,
    `scopeKind` VARCHAR(20) NOT NULL,
    `system` BOOLEAN NOT NULL DEFAULT false,
    `active` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_roles` (
    `code` VARCHAR(30) NOT NULL,
    `label` VARCHAR(120) NOT NULL,
    `jurisdiction` VARCHAR(30) NOT NULL,
    `can_appraisals` BOOLEAN NOT NULL DEFAULT true,
    `can_financial_years` BOOLEAN NOT NULL DEFAULT false,
    `can_organization` BOOLEAN NOT NULL DEFAULT false,
    `can_personnel` BOOLEAN NOT NULL DEFAULT false,
    `can_allowances` BOOLEAN NOT NULL DEFAULT false,
    `can_allowance_types` BOOLEAN NOT NULL DEFAULT false,
    `can_allowance_catalog` BOOLEAN NOT NULL DEFAULT false,
    `can_allowance_rates` BOOLEAN NOT NULL DEFAULT false,
    `can_allowance_allocations` BOOLEAN NOT NULL DEFAULT false,
    `can_position_keywords` BOOLEAN NOT NULL DEFAULT false,
    `can_allowance_matrix` BOOLEAN NOT NULL DEFAULT false,
    `can_validate` BOOLEAN NOT NULL DEFAULT false,
    `can_demote_classification` BOOLEAN NOT NULL DEFAULT false,
    `can_edit_validated` BOOLEAN NOT NULL DEFAULT false,
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

-- CreateTable
CREATE TABLE `tbl_allowance` (
    `id` VARCHAR(191) NOT NULL,
    `allowanceName` VARCHAR(191) NOT NULL,
    `allowanceTypeId` VARCHAR(191) NULL,
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

    INDEX `tbl_allowance_allowanceTypeId_idx`(`allowanceTypeId`),
    INDEX `tbl_allowance_workflowStatus_idx`(`workflowStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_allowance_type` (
    `id` VARCHAR(191) NOT NULL,
    `allowanceTypeName` VARCHAR(191) NOT NULL,
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

    INDEX `tbl_allowance_type_workflowStatus_idx`(`workflowStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_allowance_rate` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `allowanceId` VARCHAR(191) NOT NULL,
    `positionKeywordId` INTEGER NULL,
    `allowance_amt_min` DOUBLE NOT NULL,
    `allowance_amt_max` DOUBLE NOT NULL,
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

    INDEX `tbl_allowance_rate_allowanceId_idx`(`allowanceId`),
    INDEX `tbl_allowance_rate_positionKeywordId_idx`(`positionKeywordId`),
    INDEX `tbl_allowance_rate_allowanceId_positionKeywordId_idx`(`allowanceId`, `positionKeywordId`),
    INDEX `tbl_allowance_rate_workflowStatus_idx`(`workflowStatus`),
    INDEX `tbl_allowance_rate_allowanceId_effectiveDate_idx`(`allowanceId`, `effectiveDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_allowance_allocation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `matricule` VARCHAR(191) NOT NULL,
    `allowanceId` VARCHAR(191) NOT NULL,
    `allowance_amt` DOUBLE NOT NULL,
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

    INDEX `tbl_allowance_allocation_allowanceId_idx`(`allowanceId`),
    INDEX `tbl_allowance_allocation_matricule_idx`(`matricule`),
    INDEX `tbl_allowance_allocation_workflowStatus_idx`(`workflowStatus`),
    INDEX `tbl_allowance_allocation_matricule_allowanceId_effectiveDate_idx`(`matricule`, `allowanceId`, `effectiveDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_position_keyword` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `keyword` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `tbl_position_keyword_active_idx`(`active`),
    UNIQUE INDEX `tbl_position_keyword_keyword_key`(`keyword`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_allowance_keyword` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `allowanceId` VARCHAR(191) NOT NULL,
    `keywordId` INTEGER NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `tbl_allowance_keyword_keywordId_idx`(`keywordId`),
    INDEX `tbl_allowance_keyword_allowanceId_idx`(`allowanceId`),
    INDEX `tbl_allowance_keyword_active_idx`(`active`),
    UNIQUE INDEX `tbl_allowance_keyword_allowanceId_keywordId_key`(`allowanceId`, `keywordId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_operator` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `address` VARCHAR(191) NOT NULL,
    `country` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,

    INDEX `tbl_operator_isActive_idx`(`isActive`),
    INDEX `tbl_operator_email_idx`(`email`),
    INDEX `tbl_operator_phone_idx`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `number_prefix` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `prefix` VARCHAR(191) NOT NULL,
    `operator_id` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,

    INDEX `number_prefix_isActive_idx`(`isActive`),
    INDEX `number_prefix_prefix_idx`(`prefix`),
    INDEX `number_prefix_createdAt_idx`(`createdAt`),
    INDEX `number_prefix_updatedAt_idx`(`updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fleet_registration` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `matricule` VARCHAR(191) NOT NULL,
    `operator_id` INTEGER NOT NULL,
    `amount` DOUBLE NOT NULL,
    `effective_date` DATETIME(3) NOT NULL,
    `end_date` DATETIME(3) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `fleet_registration_isActive_idx`(`isActive`),
    INDEX `fleet_registration_matricule_idx`(`matricule`),
    INDEX `fleet_registration_createdAt_idx`(`createdAt`),
    INDEX `fleet_registration_updatedAt_idx`(`updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fleet_payment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `matricule` VARCHAR(191) NOT NULL,
    `operator_id` INTEGER NOT NULL,
    `amount` DOUBLE NOT NULL,
    `effective_date` DATETIME(3) NOT NULL,
    `end_date` DATETIME(3) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `fleet_payment_isActive_idx`(`isActive`),
    INDEX `fleet_payment_matricule_idx`(`matricule`),
    INDEX `fleet_payment_createdAt_idx`(`createdAt`),
    INDEX `fleet_payment_updatedAt_idx`(`updatedAt`),
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
ALTER TABLE `tbl_emp_contract` ADD CONSTRAINT `tbl_emp_contract_employmentId_fkey` FOREIGN KEY (`employmentId`) REFERENCES `tbl_emp_employment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_emp_family_member` ADD CONSTRAINT `tbl_emp_family_member_matricule_fkey` FOREIGN KEY (`matricule`) REFERENCES `tbl_employee`(`matricule`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_emp_nextkin` ADD CONSTRAINT `tbl_emp_nextkin_matricule_fkey` FOREIGN KEY (`matricule`) REFERENCES `tbl_employee`(`matricule`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_emp_departure` ADD CONSTRAINT `tbl_emp_departure_departureId_fkey` FOREIGN KEY (`departureId`) REFERENCES `tbl_departure`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE `tbl_scale2` ADD CONSTRAINT `_24ba9bd7-e161-4baa-80f4-a52528d50bb5_` FOREIGN KEY (`catid`) REFERENCES `tbl_scale1`(`catid`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_users` ADD CONSTRAINT `tbl_users_tbl_financialyear_id_fkey` FOREIGN KEY (`tbl_financialyear_id`) REFERENCES `tbl_financialyear`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_zone` ADD CONSTRAINT `tbl_zone_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `tbl_group`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_unit` ADD CONSTRAINT `tbl_unit_zoneId_fkey` FOREIGN KEY (`zoneId`) REFERENCES `tbl_zone`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_decision_assignment` ADD CONSTRAINT `tbl_decision_assignment_level_code_fkey` FOREIGN KEY (`level_code`) REFERENCES `tbl_decision_level`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_unit_letter_cc_hide` ADD CONSTRAINT `tbl_unit_letter_cc_hide_letter_cc_id_fkey` FOREIGN KEY (`letter_cc_id`) REFERENCES `tbl_letter_cc`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_section_thro` ADD CONSTRAINT `tbl_section_thro_tbl_section_id_fkey` FOREIGN KEY (`tbl_section_id`) REFERENCES `tbl_section`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_allowance` ADD CONSTRAINT `tbl_allowance_allowanceTypeId_fkey` FOREIGN KEY (`allowanceTypeId`) REFERENCES `tbl_allowance_type`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_allowance_rate` ADD CONSTRAINT `tbl_allowance_rate_allowanceId_fkey` FOREIGN KEY (`allowanceId`) REFERENCES `tbl_allowance`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_allowance_rate` ADD CONSTRAINT `tbl_allowance_rate_positionKeywordId_fkey` FOREIGN KEY (`positionKeywordId`) REFERENCES `tbl_position_keyword`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_allowance_allocation` ADD CONSTRAINT `tbl_allowance_allocation_allowanceId_fkey` FOREIGN KEY (`allowanceId`) REFERENCES `tbl_allowance`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_allowance_allocation` ADD CONSTRAINT `tbl_allowance_allocation_matricule_fkey` FOREIGN KEY (`matricule`) REFERENCES `tbl_employee`(`matricule`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_allowance_keyword` ADD CONSTRAINT `tbl_allowance_keyword_allowanceId_fkey` FOREIGN KEY (`allowanceId`) REFERENCES `tbl_allowance`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_allowance_keyword` ADD CONSTRAINT `tbl_allowance_keyword_keywordId_fkey` FOREIGN KEY (`keywordId`) REFERENCES `tbl_position_keyword`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `number_prefix` ADD CONSTRAINT `number_prefix_operator_id_fkey` FOREIGN KEY (`operator_id`) REFERENCES `tbl_operator`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fleet_registration` ADD CONSTRAINT `fleet_registration_operator_id_fkey` FOREIGN KEY (`operator_id`) REFERENCES `tbl_operator`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fleet_registration` ADD CONSTRAINT `fleet_registration_matricule_fkey` FOREIGN KEY (`matricule`) REFERENCES `tbl_employee`(`matricule`) ON DELETE RESTRICT ON UPDATE CASCADE;
