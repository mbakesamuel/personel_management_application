-- DropForeignKey
ALTER TABLE `tbl_employee_leave_history` DROP FOREIGN KEY `tbl_employee_leave_history_leaveGrantId_fkey`;

-- DropForeignKey
ALTER TABLE `tbl_employee_sanction` DROP FOREIGN KEY `tbl_employee_sanction_memoId_fkey`;

-- DropForeignKey
ALTER TABLE `tbl_leave_accrual_ledger` DROP FOREIGN KEY `tbl_leave_accrual_ledger_leaveRequestId_fkey`;

-- DropIndex
DROP INDEX `tbl_employee_sanction_memoId_fkey` ON `tbl_employee_sanction`;

-- AlterTable
ALTER TABLE `tbl_employee_leave_history` MODIFY `leaveGrantId` INTEGER NULL;

-- AlterTable
ALTER TABLE `tbl_leave_letter_setting` MODIFY `id` INTEGER NOT NULL DEFAULT 1;

-- AddForeignKey
ALTER TABLE `tbl_employee_sanction` ADD CONSTRAINT `tbl_employee_sanction_memoId_fkey` FOREIGN KEY (`memoId`) REFERENCES `tbl_employee_memo`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_employee_leave_history` ADD CONSTRAINT `tbl_employee_leave_history_leaveGrantId_fkey` FOREIGN KEY (`leaveGrantId`) REFERENCES `tbl_leave_grant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_leave_accrual_ledger` ADD CONSTRAINT `tbl_leave_accrual_ledger_leaveRequestId_fkey` FOREIGN KEY (`leaveRequestId`) REFERENCES `tbl_leave_request`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
