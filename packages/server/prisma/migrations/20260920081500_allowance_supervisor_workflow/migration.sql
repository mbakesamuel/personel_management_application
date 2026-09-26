-- Create allowance tables with supervisor validation workflow

CREATE TABLE `tbl_allowance_type` (
  `id` VARCHAR(191) NOT NULL,
  `allowanceTypeName` VARCHAR(191) NOT NULL,
  `workflowStatus` ENUM('PENDING', 'VALIDATED', 'REJECTED', 'SUPERSEDED') NOT NULL DEFAULT 'PENDING',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdById` INT NOT NULL,
  `updatedAt` DATETIME(3) NOT NULL,
  `updatedById` INT NULL,
  `validatedAt` DATETIME(3) NULL,
  `validatedById` INT NULL,
  `rejectedAt` DATETIME(3) NULL,
  `rejectedById` INT NULL,
  `reviewNote` VARCHAR(191) NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `tbl_allowance_type_workflowStatus_idx` ON `tbl_allowance_type`(`workflowStatus`);

CREATE TABLE `tbl_allowance` (
  `id` VARCHAR(191) NOT NULL,
  `allowanceName` VARCHAR(191) NOT NULL,
  `allowanceTypeId` VARCHAR(191) NULL,
  `workflowStatus` ENUM('PENDING', 'VALIDATED', 'REJECTED', 'SUPERSEDED') NOT NULL DEFAULT 'PENDING',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdById` INT NOT NULL,
  `updatedAt` DATETIME(3) NOT NULL,
  `updatedById` INT NULL,
  `validatedAt` DATETIME(3) NULL,
  `validatedById` INT NULL,
  `rejectedAt` DATETIME(3) NULL,
  `rejectedById` INT NULL,
  `reviewNote` VARCHAR(191) NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `tbl_allowance_allowanceTypeId_idx` ON `tbl_allowance`(`allowanceTypeId`);
CREATE INDEX `tbl_allowance_workflowStatus_idx` ON `tbl_allowance`(`workflowStatus`);

ALTER TABLE `tbl_allowance`
  ADD CONSTRAINT `tbl_allowance_allowanceTypeId_fkey`
  FOREIGN KEY (`allowanceTypeId`) REFERENCES `tbl_allowance_type`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `tbl_allowance_rate` (
  `id` VARCHAR(191) NOT NULL,
  `allowanceId` VARCHAR(191) NOT NULL,
  `allowance_amt` DOUBLE NOT NULL,
  `effectiveDate` DATETIME(3) NOT NULL,
  `workflowStatus` ENUM('PENDING', 'VALIDATED', 'REJECTED', 'SUPERSEDED') NOT NULL DEFAULT 'PENDING',
  `current` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdById` INT NOT NULL,
  `updatedAt` DATETIME(3) NOT NULL,
  `updatedById` INT NULL,
  `validatedAt` DATETIME(3) NULL,
  `validatedById` INT NULL,
  `rejectedAt` DATETIME(3) NULL,
  `rejectedById` INT NULL,
  `reviewNote` VARCHAR(191) NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `tbl_allowance_rate_allowanceId_idx` ON `tbl_allowance_rate`(`allowanceId`);
CREATE INDEX `tbl_allowance_rate_workflowStatus_idx` ON `tbl_allowance_rate`(`workflowStatus`);
CREATE INDEX `tbl_allowance_rate_allowanceId_effectiveDate_idx` ON `tbl_allowance_rate`(`allowanceId`, `effectiveDate`);

ALTER TABLE `tbl_allowance_rate`
  ADD CONSTRAINT `tbl_allowance_rate_allowanceId_fkey`
  FOREIGN KEY (`allowanceId`) REFERENCES `tbl_allowance`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE `tbl_allowance_allocation` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `matricule` VARCHAR(191) NOT NULL,
  `allowanceId` VARCHAR(191) NOT NULL,
  `effectiveDate` DATETIME(3) NOT NULL,
  `workflowStatus` ENUM('PENDING', 'VALIDATED', 'REJECTED', 'SUPERSEDED') NOT NULL DEFAULT 'PENDING',
  `current` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdById` INT NOT NULL,
  `updatedAt` DATETIME(3) NOT NULL,
  `updatedById` INT NULL,
  `validatedAt` DATETIME(3) NULL,
  `validatedById` INT NULL,
  `rejectedAt` DATETIME(3) NULL,
  `rejectedById` INT NULL,
  `reviewNote` VARCHAR(191) NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `tbl_allowance_allocation_allowanceId_idx` ON `tbl_allowance_allocation`(`allowanceId`);
CREATE INDEX `tbl_allowance_allocation_matricule_idx` ON `tbl_allowance_allocation`(`matricule`);
CREATE INDEX `tbl_allowance_allocation_workflowStatus_idx` ON `tbl_allowance_allocation`(`workflowStatus`);
CREATE INDEX `tbl_allowance_allocation_matricule_allowanceId_effectiveDate_idx`
  ON `tbl_allowance_allocation`(`matricule`, `allowanceId`, `effectiveDate`);

ALTER TABLE `tbl_allowance_allocation`
  ADD CONSTRAINT `tbl_allowance_allocation_allowanceId_fkey`
  FOREIGN KEY (`allowanceId`) REFERENCES `tbl_allowance`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `tbl_allowance_allocation`
  ADD CONSTRAINT `tbl_allowance_allocation_matricule_fkey`
  FOREIGN KEY (`matricule`) REFERENCES `tbl_employee`(`matricule`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
