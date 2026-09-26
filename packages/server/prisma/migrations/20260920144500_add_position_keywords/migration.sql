-- Position keywords catalog for future allowance-by-position matrix
CREATE TABLE `tbl_position_keyword` (
  `id` VARCHAR(191) NOT NULL,
  `keyword` VARCHAR(191) NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `tbl_position_keyword_keyword_key` ON `tbl_position_keyword`(`keyword`);
CREATE INDEX `tbl_position_keyword_active_idx` ON `tbl_position_keyword`(`active`);
