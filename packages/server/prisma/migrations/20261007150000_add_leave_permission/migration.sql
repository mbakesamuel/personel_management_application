-- Dedicated permission for leave setup and leave operations.
ALTER TABLE `tbl_roles`
  ADD COLUMN `can_leave` BOOLEAN NOT NULL DEFAULT false;

UPDATE `tbl_roles`
SET `can_leave` = true
WHERE `code` = 'ADMINISTRATOR';
