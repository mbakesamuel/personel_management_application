CREATE TABLE `tbl_leave_travel_allowance` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `minCategory` INTEGER NOT NULL,
    `maxCategory` INTEGER NOT NULL,
    `amount` INTEGER NOT NULL,
    `effectiveFrom` DATETIME(3) NOT NULL,
    `effectiveTo` DATETIME(3) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `tbl_leave_travel_allowance`
  (`minCategory`, `maxCategory`, `amount`, `effectiveFrom`, `active`)
VALUES
  (1, 6, 10000, '2000-01-01 00:00:00.000', true),
  (7, 9, 20000, '2000-01-01 00:00:00.000', true),
  (10, 12, 30000, '2000-01-01 00:00:00.000', true);

ALTER TABLE `tbl_leave_letter_setting`
  DROP COLUMN `travelBelowNone`,
  DROP COLUMN `travelBelowPermission`,
  DROP COLUMN `travelCategory9`;
