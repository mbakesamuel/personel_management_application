-- Map stored codes onto the shared sex enum. Blank values stay unknown.
UPDATE `tbl_employee` SET `sex` = 'Male' WHERE `sex` IN ('M', 'Male');
UPDATE `tbl_employee` SET `sex` = 'Female' WHERE `sex` IN ('F', 'Female');

-- The column is still NOT NULL, so blanks must be allowed before they can be cleared.
ALTER TABLE `tbl_employee` MODIFY `sex` VARCHAR(191) NULL;

UPDATE `tbl_employee` SET `sex` = NULL WHERE `sex` IS NULL OR TRIM(`sex`) = '';

ALTER TABLE `tbl_employee` MODIFY `sex` ENUM('Male', 'Female') NULL;

ALTER TABLE `tbl_emp_family_member` ADD COLUMN `sex` ENUM('Male', 'Female') NOT NULL;
