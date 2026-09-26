-- AlterTable
ALTER TABLE `tbl_emp_contract` ADD COLUMN `employmentId` INTEGER NULL;

-- Backfill: prefer current employment for the same matricule
UPDATE `tbl_emp_contract` c
INNER JOIN `tbl_emp_employment` e
  ON e.`matricule` = c.`matricule` AND e.`current` = true
SET c.`employmentId` = e.`id`
WHERE c.`employmentId` IS NULL;

-- Backfill: else latest employment by id for the same matricule
UPDATE `tbl_emp_contract` c
INNER JOIN (
  SELECT `matricule`, MAX(`id`) AS `maxId`
  FROM `tbl_emp_employment`
  GROUP BY `matricule`
) latest ON latest.`matricule` = c.`matricule`
SET c.`employmentId` = latest.`maxId`
WHERE c.`employmentId` IS NULL;

-- Drop contracts that still have no employment to attach to
DELETE FROM `tbl_emp_contract` WHERE `employmentId` IS NULL;

-- AlterTable
ALTER TABLE `tbl_emp_contract` MODIFY `employmentId` INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX `tbl_emp_contract_employmentId_idx` ON `tbl_emp_contract`(`employmentId`);

-- AddForeignKey
ALTER TABLE `tbl_emp_contract` ADD CONSTRAINT `tbl_emp_contract_employmentId_fkey` FOREIGN KEY (`employmentId`) REFERENCES `tbl_emp_employment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
