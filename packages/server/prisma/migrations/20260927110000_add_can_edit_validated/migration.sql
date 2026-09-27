-- Add can_edit_validated permission to roles
ALTER TABLE `tbl_roles`
  ADD COLUMN `can_edit_validated` BOOLEAN NOT NULL DEFAULT false
  AFTER `can_demote_classification`;

UPDATE `tbl_roles`
SET `can_edit_validated` = true
WHERE `code` = 'ADMINISTRATOR';
