-- Add can_allowances permission to roles
ALTER TABLE `tbl_roles`
  ADD COLUMN `can_allowances` BOOLEAN NOT NULL DEFAULT false
  AFTER `can_organization`;

UPDATE `tbl_roles`
SET `can_allowances` = true
WHERE `code` = 'ADMINISTRATOR';
