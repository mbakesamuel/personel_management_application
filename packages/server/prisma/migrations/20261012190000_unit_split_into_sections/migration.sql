ALTER TABLE `tbl_unit`
  ADD COLUMN `splitIntoSections` BOOLEAN NOT NULL DEFAULT false;

UPDATE `tbl_unit` u
SET u.splitIntoSections = true
WHERE EXISTS (
  SELECT 1 FROM `tbl_section` s
  WHERE s.tbl_unit_id COLLATE utf8mb4_0900_ai_ci = u.id COLLATE utf8mb4_0900_ai_ci
);
