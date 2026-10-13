ALTER TABLE `tbl_leave_request` ADD COLUMN `suppliedResumedDate` DATETIME(3) NULL;

CREATE TABLE `tbl_leave_processing_setting` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `userSupplyLastResumption` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
