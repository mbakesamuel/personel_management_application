CREATE TABLE `tbl_leave_mother_setting` (
  `id` INTEGER NOT NULL DEFAULT 1,
  `daysPerChild` INTEGER NOT NULL DEFAULT 0,
  `maxAgeYears` INTEGER NOT NULL DEFAULT 0,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `tbl_leave_calculation`
  ADD COLUMN `qualifyingChildCount` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `mothersLeaveDays` INTEGER NOT NULL DEFAULT 0;
