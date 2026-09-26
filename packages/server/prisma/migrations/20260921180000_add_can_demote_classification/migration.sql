-- Add can_demote_classification permission to roles
ALTER TABLE `tbl_roles`
  ADD COLUMN `can_demote_classification` BOOLEAN NOT NULL DEFAULT false
  AFTER `can_validate`;

UPDATE `tbl_roles`
SET `can_demote_classification` = true
WHERE `code` IN ('ADMINISTRATOR', 'HR_DIRECTOR');
