-- Every centre row has updatedAt 0000-00-00, which the driver cannot read.
UPDATE `tbl_insurance_centre`
SET `updatedAt` = `createdAt`
WHERE CAST(`updatedAt` AS CHAR) LIKE '0000%';

-- Imported insurance rows use place names that are not lookup ids.
INSERT INTO `tbl_insurance_centre` (`id`, `centreName`, `createdAt`, `updatedAt`) VALUES
  ('KRIBI', 'Kribi', NOW(3), NOW(3)),
  ('LIMBE', 'Limbe', NOW(3), NOW(3)),
  ('TIKO', 'Tiko', NOW(3), NOW(3)),
  ('MBANGA', 'Mbanga', NOW(3), NOW(3)),
  ('780123', 'Unknown', NOW(3), NOW(3));

UPDATE `tbl_emp_insurance`
SET `centre_id` = 'BU'
WHERE `centre_id` IN ('BUEA', 'BUE', 'BUEA.', 'BUERA', 'BUI', 'BY', 'NBU');

UPDATE `tbl_emp_insurance`
SET `centre_id` = 'KU'
WHERE `centre_id` = 'KUMBA';

UPDATE `tbl_emp_insurance`
SET `centre_id` = 'MU'
WHERE `centre_id` IN ('MUNDEMB', 'BAMUSSO');

UPDATE `tbl_emp_insurance`
SET `centre_id` = 'KA'
WHERE `centre_id` = 'NKAMBE';

UPDATE `tbl_emp_insurance`
SET `centre_id` = 'YA'
WHERE `centre_id` = 'YAOUNDE';
