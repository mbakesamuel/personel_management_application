ALTER TABLE `tbl_leave_memo`
  ADD COLUMN `accruedLastTour` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `daysTakenNow` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `accruedThisTour` INTEGER NOT NULL DEFAULT 0;

CREATE TABLE `tbl_leave_accrual_account` (
    `matricule` VARCHAR(191) NOT NULL,
    `balanceDays` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`matricule`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tbl_leave_accrual_ledger` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `matricule` VARCHAR(191) NOT NULL,
    `days` INTEGER NOT NULL,
    `kind` ENUM('CREDIT', 'DEBIT') NOT NULL,
    `leaveRequestId` INTEGER NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdById` INTEGER NOT NULL,

    UNIQUE INDEX `tbl_leave_accrual_ledger_leaveRequestId_key`(`leaveRequestId`),
    INDEX `tbl_leave_accrual_ledger_matricule_idx`(`matricule`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `tbl_leave_accrual_account`
  ADD CONSTRAINT `tbl_leave_accrual_account_matricule_fkey`
  FOREIGN KEY (`matricule`) REFERENCES `tbl_employee`(`matricule`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `tbl_leave_accrual_ledger`
  ADD CONSTRAINT `tbl_leave_accrual_ledger_matricule_fkey`
  FOREIGN KEY (`matricule`) REFERENCES `tbl_leave_accrual_account`(`matricule`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `tbl_leave_accrual_ledger_leaveRequestId_fkey`
  FOREIGN KEY (`leaveRequestId`) REFERENCES `tbl_leave_request`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
