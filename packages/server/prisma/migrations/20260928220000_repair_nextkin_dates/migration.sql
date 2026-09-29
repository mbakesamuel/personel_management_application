-- Imported next-of-kin rows use 0000-00-00, which the driver cannot read.
UPDATE `tbl_emp_nextkin`
SET `effectiveDate` = '1000-01-01 00:00:00'
WHERE CAST(`effectiveDate` AS CHAR) LIKE '0000%';

UPDATE `tbl_emp_nextkin`
SET `updatedAt` = COALESCE(
  NULLIF(`createdAt`, '0000-00-00 00:00:00'),
  NOW(3)
)
WHERE CAST(`updatedAt` AS CHAR) LIKE '0000%';
