-- Directors who sign operator memos, effective from a date.
CREATE TABLE `tbl_memoSignatory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `effective_date` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tbl_memoSignatory_effective_date_key`(`effective_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `tbl_memoSignatory` (`name`, `title`, `effective_date`)
VALUES ('Noupieple Hugues', 'Manager Information Systems', '2000-01-01 00:00:00');
