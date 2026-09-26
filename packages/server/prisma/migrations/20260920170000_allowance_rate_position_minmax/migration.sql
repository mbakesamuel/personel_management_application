-- Position-specific rate amounts (min/max)

ALTER TABLE `tbl_allowance_rate`
  ADD COLUMN `positionKeywordId` INTEGER NULL,
  ADD COLUMN `allowance_amt_min` DOUBLE NULL,
  ADD COLUMN `allowance_amt_max` DOUBLE NULL;

UPDATE `tbl_allowance_rate`
SET
  `allowance_amt_min` = `allowance_amt`,
  `allowance_amt_max` = `allowance_amt`;

ALTER TABLE `tbl_allowance_rate`
  MODIFY `allowance_amt_min` DOUBLE NOT NULL,
  MODIFY `allowance_amt_max` DOUBLE NOT NULL,
  DROP COLUMN `allowance_amt`;

CREATE INDEX `tbl_allowance_rate_positionKeywordId_idx` ON `tbl_allowance_rate`(`positionKeywordId`);
CREATE INDEX `tbl_allowance_rate_allowanceId_positionKeywordId_idx` ON `tbl_allowance_rate`(`allowanceId`, `positionKeywordId`);

ALTER TABLE `tbl_allowance_rate`
  ADD CONSTRAINT `tbl_allowance_rate_positionKeywordId_fkey`
  FOREIGN KEY (`positionKeywordId`) REFERENCES `tbl_position_keyword`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
