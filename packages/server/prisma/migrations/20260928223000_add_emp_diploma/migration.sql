-- CreateTable
CREATE TABLE `tbl_emp_diploma` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `matricule` VARCHAR(191) NOT NULL,
    `diplomaId` VARCHAR(191) NOT NULL,
    `dateObtained` DATETIME(3) NOT NULL,
    `subject` VARCHAR(191) NULL,
    `institution` VARCHAR(191) NULL,
    `remarks` VARCHAR(191) NULL,
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

    INDEX `tbl_emp_diploma_matricule_idx`(`matricule`),
    INDEX `tbl_emp_diploma_workflowStatus_idx`(`workflowStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `tbl_emp_diploma` ADD CONSTRAINT `tbl_emp_diploma_diplomaId_fkey` FOREIGN KEY (`diplomaId`) REFERENCES `tbl_diploma`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_emp_diploma` ADD CONSTRAINT `tbl_emp_diploma_matricule_fkey` FOREIGN KEY (`matricule`) REFERENCES `tbl_employee`(`matricule`) ON DELETE RESTRICT ON UPDATE CASCADE;
