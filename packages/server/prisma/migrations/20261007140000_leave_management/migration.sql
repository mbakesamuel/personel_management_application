-- CreateTable
CREATE TABLE `tbl_leave_type` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `requireAttachment` BOOLEAN NOT NULL DEFAULT false,
    `carryForwardAllowed` BOOLEAN NOT NULL DEFAULT false,
    `active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `tbl_leave_type_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_leave_calculation_policy` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `method` ENUM('METHOD_1', 'METHOD_2') NOT NULL,
    `effectiveFrom` DATETIME(3) NOT NULL,
    `effectiveTo` DATETIME(3) NULL,
    `active` BOOLEAN NOT NULL DEFAULT false,
    `description` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `tbl_leave_calculation_policy_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_leave_entitlement_rule` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `annualDays` DECIMAL(8, 2) NOT NULL,
    `effectiveFrom` DATETIME(3) NOT NULL,
    `effectiveTo` DATETIME(3) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_leave_monthly_rate_rule` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `monthlyDays` DECIMAL(8, 4) NOT NULL,
    `effectiveFrom` DATETIME(3) NOT NULL,
    `effectiveTo` DATETIME(3) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_leave_seniority_rule` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `minYears` INTEGER NOT NULL,
    `maxYears` INTEGER NULL,
    `bonusDays` DECIMAL(8, 2) NOT NULL,
    `effectiveFrom` DATETIME(3) NOT NULL,
    `effectiveTo` DATETIME(3) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_leave_request` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `leaveRef` VARCHAR(191) NULL,
    `matricule` VARCHAR(191) NOT NULL,
    `leaveTypeId` INTEGER NOT NULL,
    `applicationDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `requestedDays` DECIMAL(8, 2) NOT NULL,
    `reason` TEXT NULL,
    `workflowStatus` ENUM('PENDING', 'VALIDATED', 'REJECTED', 'SUPERSEDED') NOT NULL DEFAULT 'PENDING',
    `current` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdById` INTEGER NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `updatedById` INTEGER NULL,
    `validatedAt` DATETIME(3) NULL,
    `validatedById` INTEGER NULL,
    `rejectedAt` DATETIME(3) NULL,
    `rejectedById` INTEGER NULL,
    `reviewNote` VARCHAR(191) NULL,

    UNIQUE INDEX `tbl_leave_request_leaveRef_key`(`leaveRef`),
    INDEX `tbl_leave_request_matricule_idx`(`matricule`),
    INDEX `tbl_leave_request_workflowStatus_idx`(`workflowStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_leave_attachment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `leaveRequestId` INTEGER NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `originalName` VARCHAR(191) NOT NULL,
    `filePath` VARCHAR(191) NOT NULL,
    `uploadedById` INTEGER NOT NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_leave_calculation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `matricule` VARCHAR(191) NOT NULL,
    `leaveRequestId` INTEGER NOT NULL,
    `policyId` INTEGER NOT NULL,
    `accrualStartDate` DATETIME(3) NOT NULL,
    `accrualEndDate` DATETIME(3) NOT NULL,
    `serviceYears` DECIMAL(8, 2) NOT NULL,
    `eligibleMonths` DECIMAL(8, 2) NOT NULL,
    `basicDays` DECIMAL(8, 2) NOT NULL,
    `seniorityDays` DECIMAL(8, 2) NOT NULL,
    `monthlyAccrual` DECIMAL(8, 4) NOT NULL,
    `entitledDays` DECIMAL(8, 2) NOT NULL,
    `calculatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `tbl_leave_calculation_matricule_idx`(`matricule`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_leave_grant` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `leaveRequestId` INTEGER NOT NULL,
    `calculationId` INTEGER NOT NULL,
    `grantedDays` DECIMAL(8, 2) NOT NULL,
    `leaveStartDate` DATETIME(3) NOT NULL,
    `leaveEndDate` DATETIME(3) NOT NULL,
    `expectedReturnDate` DATETIME(3) NOT NULL,
    `grantedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `grantedById` INTEGER NOT NULL,

    UNIQUE INDEX `tbl_leave_grant_leaveRequestId_key`(`leaveRequestId`),
    UNIQUE INDEX `tbl_leave_grant_calculationId_key`(`calculationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_employee_leave_history` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `matricule` VARCHAR(191) NOT NULL,
    `leaveGrantId` INTEGER NOT NULL,
    `leaveStartDate` DATETIME(3) NOT NULL,
    `leaveEndDate` DATETIME(3) NOT NULL,
    `resumedDate` DATETIME(3) NULL,
    `daysGranted` DECIMAL(8, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `tbl_employee_leave_history_leaveGrantId_key`(`leaveGrantId`),
    INDEX `tbl_employee_leave_history_matricule_idx`(`matricule`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_leave_resumption` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `matricule` VARCHAR(191) NOT NULL,
    `leaveRequestId` INTEGER NOT NULL,
    `actualReturnDate` DATETIME(3) NOT NULL,
    `remarks` VARCHAR(191) NULL,
    `resumedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resumedById` INTEGER NOT NULL,

    INDEX `tbl_leave_resumption_matricule_idx`(`matricule`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `tbl_leave_request` ADD CONSTRAINT `tbl_leave_request_matricule_fkey` FOREIGN KEY (`matricule`) REFERENCES `tbl_employee`(`matricule`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `tbl_leave_request` ADD CONSTRAINT `tbl_leave_request_leaveTypeId_fkey` FOREIGN KEY (`leaveTypeId`) REFERENCES `tbl_leave_type`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `tbl_leave_attachment` ADD CONSTRAINT `tbl_leave_attachment_leaveRequestId_fkey` FOREIGN KEY (`leaveRequestId`) REFERENCES `tbl_leave_request`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `tbl_leave_calculation` ADD CONSTRAINT `tbl_leave_calculation_matricule_fkey` FOREIGN KEY (`matricule`) REFERENCES `tbl_employee`(`matricule`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `tbl_leave_calculation` ADD CONSTRAINT `tbl_leave_calculation_leaveRequestId_fkey` FOREIGN KEY (`leaveRequestId`) REFERENCES `tbl_leave_request`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `tbl_leave_calculation` ADD CONSTRAINT `tbl_leave_calculation_policyId_fkey` FOREIGN KEY (`policyId`) REFERENCES `tbl_leave_calculation_policy`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `tbl_leave_grant` ADD CONSTRAINT `tbl_leave_grant_leaveRequestId_fkey` FOREIGN KEY (`leaveRequestId`) REFERENCES `tbl_leave_request`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `tbl_leave_grant` ADD CONSTRAINT `tbl_leave_grant_calculationId_fkey` FOREIGN KEY (`calculationId`) REFERENCES `tbl_leave_calculation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `tbl_employee_leave_history` ADD CONSTRAINT `tbl_employee_leave_history_matricule_fkey` FOREIGN KEY (`matricule`) REFERENCES `tbl_employee`(`matricule`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `tbl_employee_leave_history` ADD CONSTRAINT `tbl_employee_leave_history_leaveGrantId_fkey` FOREIGN KEY (`leaveGrantId`) REFERENCES `tbl_leave_grant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `tbl_leave_resumption` ADD CONSTRAINT `tbl_leave_resumption_matricule_fkey` FOREIGN KEY (`matricule`) REFERENCES `tbl_employee`(`matricule`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `tbl_leave_resumption` ADD CONSTRAINT `tbl_leave_resumption_leaveRequestId_fkey` FOREIGN KEY (`leaveRequestId`) REFERENCES `tbl_leave_request`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
