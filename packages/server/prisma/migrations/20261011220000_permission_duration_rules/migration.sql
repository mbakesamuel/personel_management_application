CREATE TABLE `tbl_permission_duration_rule` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `leaveTypeId` INTEGER NOT NULL,
    `days` INTEGER NOT NULL,
    `effectiveFrom` DATETIME(3) NOT NULL,
    `effectiveTo` DATETIME(3) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `tbl_permission_duration_rule_leaveTypeId_idx`(`leaveTypeId`),
    UNIQUE INDEX `tbl_permission_duration_rule_leaveTypeId_effectiveFrom_key`(`leaveTypeId`, `effectiveFrom`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `tbl_permission_duration_rule`
  ADD CONSTRAINT `tbl_permission_duration_rule_leaveTypeId_fkey`
  FOREIGN KEY (`leaveTypeId`) REFERENCES `tbl_leave_type`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO `tbl_permission_duration_rule` (`leaveTypeId`, `days`, `effectiveFrom`, `active`)
SELECT `id`, `maxDays`, '2026-01-01 00:00:00.000', true
FROM `tbl_leave_type`
WHERE `category` = 'PERMISSION' AND `isPaid` = true AND `maxDays` IS NOT NULL;
