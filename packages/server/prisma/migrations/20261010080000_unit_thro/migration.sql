CREATE TABLE `tbl_unit_thro` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tbl_unit_id` VARCHAR(191) NOT NULL,
    `signatory` VARCHAR(255) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `effdate` DATETIME(0) NOT NULL,

    INDEX `tbl_unit_thro_tbl_unit_id_idx`(`tbl_unit_id`),
    INDEX `tbl_unit_thro_effdate_idx`(`effdate`),
    UNIQUE INDEX `uniq_unit_thro_effdate`(`tbl_unit_id`, `effdate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `tbl_unit_thro` ADD CONSTRAINT `tbl_unit_thro_tbl_unit_id_fkey` FOREIGN KEY (`tbl_unit_id`) REFERENCES `tbl_unit`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
