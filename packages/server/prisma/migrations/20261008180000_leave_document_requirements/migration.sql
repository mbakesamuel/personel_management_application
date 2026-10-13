CREATE TABLE `tbl_leave_document_requirement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `leaveTypeId` INTEGER NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `sortOrder` INTEGER NOT NULL,

    INDEX `tbl_leave_document_requirement_leaveTypeId_idx`(`leaveTypeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `tbl_leave_attachment` ADD COLUMN `requirementId` INTEGER NULL;

CREATE INDEX `tbl_leave_attachment_requirementId_idx` ON `tbl_leave_attachment`(`requirementId`);

ALTER TABLE `tbl_leave_document_requirement` ADD CONSTRAINT `tbl_leave_document_requirement_leaveTypeId_fkey` FOREIGN KEY (`leaveTypeId`) REFERENCES `tbl_leave_type`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `tbl_leave_attachment` ADD CONSTRAINT `tbl_leave_attachment_requirementId_fkey` FOREIGN KEY (`requirementId`) REFERENCES `tbl_leave_document_requirement`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
