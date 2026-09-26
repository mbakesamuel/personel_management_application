-- Add can_validate permission to roles
ALTER TABLE `tbl_roles`
  ADD COLUMN `can_validate` BOOLEAN NOT NULL DEFAULT false
  AFTER `can_allowances`;

UPDATE `tbl_roles`
SET `can_validate` = true
WHERE `code` = 'ADMINISTRATOR';
