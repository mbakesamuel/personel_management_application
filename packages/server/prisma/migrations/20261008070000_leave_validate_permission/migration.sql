-- Separate permission for validating and rejecting leave and permission days.
ALTER TABLE `tbl_roles`
  ADD COLUMN `can_leave_validate` BOOLEAN NOT NULL DEFAULT false;

UPDATE `tbl_roles`
SET `can_leave_validate` = true
WHERE `code` = 'ADMINISTRATOR';
