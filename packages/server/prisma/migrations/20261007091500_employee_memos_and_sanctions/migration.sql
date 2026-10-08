-- CreateTable
CREATE TABLE `tbl_memo_type` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `tbl_memo_type_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_employee_memo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `matricule` VARCHAR(191) NOT NULL,
    `memoTypeId` INTEGER NOT NULL,
    `memoNumber` VARCHAR(191) NULL,
    `memoDate` DATETIME(3) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `details` TEXT NULL,
    `incidentDate` DATETIME(3) NULL,
    `effectiveDate` DATETIME(3) NULL,
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

    UNIQUE INDEX `tbl_employee_memo_memoNumber_key`(`memoNumber`),
    INDEX `tbl_employee_memo_matricule_idx`(`matricule`),
    INDEX `tbl_employee_memo_memoTypeId_idx`(`memoTypeId`),
    INDEX `tbl_employee_memo_memoDate_idx`(`memoDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_employee_memo_attachment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `memoId` INTEGER NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `originalName` VARCHAR(191) NOT NULL,
    `filePath` VARCHAR(191) NOT NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `uploadedById` INTEGER NOT NULL,
    `remarks` VARCHAR(191) NULL,

    INDEX `tbl_employee_memo_attachment_memoId_idx`(`memoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_employee_sanction` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `matricule` VARCHAR(191) NOT NULL,
    `memoId` INTEGER NULL,
    `sanctionId` INTEGER NOT NULL,
    `reason` TEXT NULL,
    `startDate` DATETIME(3) NULL,
    `endDate` DATETIME(3) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
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

    INDEX `tbl_employee_sanction_matricule_idx`(`matricule`),
    INDEX `tbl_employee_sanction_sanctionId_idx`(`sanctionId`),
    INDEX `tbl_employee_sanction_active_idx`(`active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `tbl_employee_memo` ADD CONSTRAINT `tbl_employee_memo_matricule_fkey` FOREIGN KEY (`matricule`) REFERENCES `tbl_employee`(`matricule`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_employee_memo` ADD CONSTRAINT `tbl_employee_memo_memoTypeId_fkey` FOREIGN KEY (`memoTypeId`) REFERENCES `tbl_memo_type`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_employee_memo_attachment` ADD CONSTRAINT `tbl_employee_memo_attachment_memoId_fkey` FOREIGN KEY (`memoId`) REFERENCES `tbl_employee_memo`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_employee_sanction` ADD CONSTRAINT `tbl_employee_sanction_matricule_fkey` FOREIGN KEY (`matricule`) REFERENCES `tbl_employee`(`matricule`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_employee_sanction` ADD CONSTRAINT `tbl_employee_sanction_memoId_fkey` FOREIGN KEY (`memoId`) REFERENCES `tbl_employee_memo`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_employee_sanction` ADD CONSTRAINT `tbl_employee_sanction_sanctionId_fkey` FOREIGN KEY (`sanctionId`) REFERENCES `tbl_sanction`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
