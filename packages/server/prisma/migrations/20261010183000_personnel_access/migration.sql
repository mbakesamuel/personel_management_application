ALTER TABLE `tbl_roles`
  ADD COLUMN `personnel_access` VARCHAR(10) NOT NULL DEFAULT 'NONE';

UPDATE `tbl_roles`
SET `personnel_access` = 'ALL'
WHERE `can_personnel` = true;

ALTER TABLE `tbl_roles`
  DROP COLUMN `can_personnel`;
