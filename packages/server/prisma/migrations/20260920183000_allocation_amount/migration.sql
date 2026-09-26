-- Add amount on allowance allocations

ALTER TABLE `tbl_allowance_allocation`
  ADD COLUMN `allowance_amt` DOUBLE NULL;

UPDATE `tbl_allowance_allocation`
SET `allowance_amt` = 0
WHERE `allowance_amt` IS NULL;

ALTER TABLE `tbl_allowance_allocation`
  MODIFY `allowance_amt` DOUBLE NOT NULL;
