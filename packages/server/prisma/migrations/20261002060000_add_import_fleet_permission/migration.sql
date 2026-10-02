-- Dedicated permission for importing fleet registrations from Excel.
ALTER TABLE `tbl_roles`
  ADD COLUMN `can_import_fleet` BOOLEAN NOT NULL DEFAULT false;

UPDATE `tbl_roles`
SET `can_import_fleet` = true
WHERE `code` = 'ADMINISTRATOR';
