ALTER TABLE `tbl_leave_type`
    ADD COLUMN `category` ENUM('LEAVE', 'PERMISSION') NOT NULL DEFAULT 'LEAVE',
    ADD COLUMN `isPaid` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `deductBalance` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `maxDays` INTEGER NULL,
    ADD COLUMN `durationUnit` ENUM('WORKING_DAYS', 'CALENDAR_WEEKS') NOT NULL DEFAULT 'WORKING_DAYS',
    ADD COLUMN `description` VARCHAR(191) NULL;

UPDATE `tbl_leave_type` SET `deductBalance` = true WHERE `code` = 'ANNUAL';

ALTER TABLE `tbl_permission_request` ADD COLUMN `leaveTypeId` INTEGER NULL;

CREATE INDEX `tbl_permission_request_leaveTypeId_idx` ON `tbl_permission_request`(`leaveTypeId`);

ALTER TABLE `tbl_permission_request` ADD CONSTRAINT `tbl_permission_request_leaveTypeId_fkey` FOREIGN KEY (`leaveTypeId`) REFERENCES `tbl_leave_type`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `tbl_permission_attachment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `permissionRequestId` INTEGER NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `originalName` VARCHAR(191) NOT NULL,
    `filePath` VARCHAR(191) NOT NULL,
    `uploadedById` INTEGER NOT NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `requirementId` INTEGER NULL,

    INDEX `tbl_permission_attachment_permissionRequestId_idx`(`permissionRequestId`),
    INDEX `tbl_permission_attachment_requirementId_idx`(`requirementId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `tbl_permission_attachment` ADD CONSTRAINT `tbl_permission_attachment_permissionRequestId_fkey` FOREIGN KEY (`permissionRequestId`) REFERENCES `tbl_permission_request`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `tbl_permission_attachment` ADD CONSTRAINT `tbl_permission_attachment_requirementId_fkey` FOREIGN KEY (`requirementId`) REFERENCES `tbl_leave_document_requirement`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
