-- Leave end date is set when the leave is processed. Requested days are no longer captured.
ALTER TABLE `tbl_leave_request`
  MODIFY `endDate` DATETIME(3) NULL,
  DROP COLUMN `requestedDays`;

CREATE TABLE `tbl_public_holiday` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `holidayDate` DATETIME(3) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `tbl_public_holiday_holidayDate_key`(`holidayDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tbl_leave_letter_setting` (
    `id` INTEGER NOT NULL,
    `travelBelowNone` INTEGER NOT NULL DEFAULT 10000,
    `travelBelowPermission` INTEGER NOT NULL DEFAULT 20000,
    `travelCategory9` INTEGER NOT NULL DEFAULT 30000,
    `fromBelow` VARCHAR(120) NOT NULL DEFAULT 'DHR',
    `throBelow` VARCHAR(120) NOT NULL DEFAULT 'AO (HRD)',
    `delegationPreface` VARCHAR(255) NOT NULL DEFAULT 'For the Director, Human Resources And By Delegation',
    `delegationName` VARCHAR(120) NOT NULL DEFAULT 'Obase Divine Nakeli',
    `delegationTitle` VARCHAR(160) NOT NULL DEFAULT 'Manager Human Resources Dev''t Service',
    `fromCategory9` VARCHAR(120) NOT NULL DEFAULT 'Director, Human Resources',
    `throCategory9Fallback` VARCHAR(120) NOT NULL DEFAULT 'DTS',
    `signCategory9` VARCHAR(160) NOT NULL DEFAULT 'DIRECTOR, HUMAN RESOURCES',
    `ccBelow` VARCHAR(500) NOT NULL DEFAULT 'FIN.D\nMHRDS\nAO (HRD)',
    `ccCategory9` VARCHAR(500) NOT NULL DEFAULT 'FIN.D\nDTS\nMHRDS\nAg. HRO (TSD)',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `tbl_leave_letter_setting` (`id`) VALUES (1);

CREATE TABLE `tbl_permission_request` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `matricule` VARCHAR(191) NOT NULL,
    `days` INTEGER NOT NULL,
    `applicationDate` DATETIME(3) NOT NULL,
    `reason` TEXT NULL,
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

    INDEX `tbl_permission_request_matricule_idx`(`matricule`),
    INDEX `tbl_permission_request_workflowStatus_idx`(`workflowStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tbl_permission_account` (
    `matricule` VARCHAR(191) NOT NULL,
    `balanceDays` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`matricule`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tbl_permission_ledger` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `matricule` VARCHAR(191) NOT NULL,
    `days` INTEGER NOT NULL,
    `kind` ENUM('CREDIT', 'DEBIT') NOT NULL,
    `permissionRequestId` INTEGER NULL,
    `leaveRequestId` INTEGER NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdById` INTEGER NOT NULL,

    UNIQUE INDEX `tbl_permission_ledger_permissionRequestId_key`(`permissionRequestId`),
    UNIQUE INDEX `tbl_permission_ledger_leaveRequestId_key`(`leaveRequestId`),
    INDEX `tbl_permission_ledger_matricule_idx`(`matricule`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tbl_leave_memo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `leaveRequestId` INTEGER NOT NULL,
    `template` VARCHAR(40) NOT NULL,
    `memoRef` VARCHAR(40) NOT NULL,
    `memoDate` DATETIME(3) NOT NULL,
    `entitledDays` INTEGER NOT NULL,
    `permissionDays` INTEGER NOT NULL,
    `netDays` INTEGER NOT NULL,
    `travelAllowance` INTEGER NOT NULL,
    `accrualStartDate` DATETIME(3) NULL,
    `accrualEndDate` DATETIME(3) NULL,
    `employeeName` VARCHAR(191) NOT NULL,
    `designation` VARCHAR(191) NULL,
    `fromTitle` VARCHAR(120) NOT NULL,
    `throTitle` VARCHAR(120) NOT NULL,
    `signatoryPreface` VARCHAR(255) NULL,
    `signatoryName` VARCHAR(120) NULL,
    `signatoryTitle` VARCHAR(160) NOT NULL,
    `ccText` VARCHAR(500) NOT NULL,
    `html` LONGTEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `tbl_leave_memo_leaveRequestId_key`(`leaveRequestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `tbl_permission_request`
  ADD CONSTRAINT `tbl_permission_request_matricule_fkey`
  FOREIGN KEY (`matricule`) REFERENCES `tbl_employee`(`matricule`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `tbl_permission_account`
  ADD CONSTRAINT `tbl_permission_account_matricule_fkey`
  FOREIGN KEY (`matricule`) REFERENCES `tbl_employee`(`matricule`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `tbl_permission_ledger`
  ADD CONSTRAINT `tbl_permission_ledger_matricule_fkey`
  FOREIGN KEY (`matricule`) REFERENCES `tbl_permission_account`(`matricule`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `tbl_permission_ledger_permissionRequestId_fkey`
  FOREIGN KEY (`permissionRequestId`) REFERENCES `tbl_permission_request`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `tbl_permission_ledger_leaveRequestId_fkey`
  FOREIGN KEY (`leaveRequestId`) REFERENCES `tbl_leave_request`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `tbl_leave_memo`
  ADD CONSTRAINT `tbl_leave_memo_leaveRequestId_fkey`
  FOREIGN KEY (`leaveRequestId`) REFERENCES `tbl_leave_request`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
