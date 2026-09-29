-- Rename effectiveDate so existing dates are kept, then drop endDate.
ALTER TABLE `tbl_emp_family_member` CHANGE `effectiveDate` `applicationDate` DATETIME(3) NOT NULL;

ALTER TABLE `tbl_emp_family_member` DROP COLUMN `endDate`;

-- Existing rows get an empty certificate number; new rows must supply one.
ALTER TABLE `tbl_emp_family_member` ADD COLUMN `certificateNo` VARCHAR(191) NOT NULL DEFAULT '';

ALTER TABLE `tbl_emp_family_member` ALTER COLUMN `certificateNo` DROP DEFAULT;
