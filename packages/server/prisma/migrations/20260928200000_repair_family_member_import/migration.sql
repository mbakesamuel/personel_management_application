-- Imported rows use 0000-00-00, which the driver cannot read.
UPDATE `tbl_emp_family_member`
SET `applicationDate` = '1000-01-01 00:00:00'
WHERE CAST(`applicationDate` AS CHAR) LIKE '0000%';

-- Six imported rows have an empty relationship, which is not SPOUSE or CHILD.
ALTER TABLE `tbl_emp_family_member`
  MODIFY `relationship` ENUM('SPOUSE', 'CHILD') NULL;

UPDATE `tbl_emp_family_member`
SET `relationship` = NULL
WHERE `relationship` IS NULL OR `relationship` = '';
