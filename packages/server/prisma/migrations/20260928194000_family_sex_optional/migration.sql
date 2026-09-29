-- Imported family rows have an empty sex value, which Prisma cannot read as Male or Female.
ALTER TABLE `tbl_emp_family_member` MODIFY `sex` ENUM('Male', 'Female') NULL;

UPDATE `tbl_emp_family_member` SET `sex` = NULL WHERE `sex` IS NULL OR `sex` = '';
