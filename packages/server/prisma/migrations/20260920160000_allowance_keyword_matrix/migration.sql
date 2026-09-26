-- Allowance–keyword eligibility matrix
CREATE TABLE `tbl_allowance_keyword` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `allowanceId` VARCHAR(191) NOT NULL,
  `keywordId` INT NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `tbl_allowance_keyword_allowanceId_keywordId_key`
  ON `tbl_allowance_keyword`(`allowanceId`, `keywordId`);
CREATE INDEX `tbl_allowance_keyword_keywordId_idx` ON `tbl_allowance_keyword`(`keywordId`);
CREATE INDEX `tbl_allowance_keyword_allowanceId_idx` ON `tbl_allowance_keyword`(`allowanceId`);
CREATE INDEX `tbl_allowance_keyword_active_idx` ON `tbl_allowance_keyword`(`active`);

ALTER TABLE `tbl_allowance_keyword`
  ADD CONSTRAINT `tbl_allowance_keyword_allowanceId_fkey`
  FOREIGN KEY (`allowanceId`) REFERENCES `tbl_allowance`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `tbl_allowance_keyword`
  ADD CONSTRAINT `tbl_allowance_keyword_keywordId_fkey`
  FOREIGN KEY (`keywordId`) REFERENCES `tbl_position_keyword`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
