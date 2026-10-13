ALTER TABLE `tbl_official_memo_signatory`
  ADD COLUMN `catFrom` INTEGER NULL,
  ADD COLUMN `catTo` INTEGER NULL;

UPDATE `tbl_official_memo_signatory` s
INNER JOIN `tbl_decision_level` l ON l.code = s.level_code
SET s.catFrom = l.cat_from,
    s.catTo = l.cat_to
WHERE s.catFrom IS NULL;

INSERT INTO `tbl_official_memo` (`code`, `name`, `system`, `sort_order`)
SELECT 'APPRAISAL', 'Appraisal letters', true, 6
WHERE NOT EXISTS (SELECT 1 FROM `tbl_official_memo` WHERE `code` = 'APPRAISAL');

INSERT INTO `tbl_official_memo` (`code`, `name`, `system`, `sort_order`)
SELECT 'ALLOWANCE_ALLOCATION', 'Allowance allocation', true, 7
WHERE NOT EXISTS (SELECT 1 FROM `tbl_official_memo` WHERE `code` = 'ALLOWANCE_ALLOCATION');

INSERT INTO `tbl_official_memo` (`code`, `name`, `system`, `sort_order`)
SELECT 'COMMUNICATION', 'Communication', true, 8
WHERE NOT EXISTS (SELECT 1 FROM `tbl_official_memo` WHERE `code` = 'COMMUNICATION');

INSERT INTO `tbl_official_memo_signatory` (
  `memo_id`, `level_code`, `signatory`, `title`, `tbl_unit_id`, `tbl_group_id`, `effdate`, `catFrom`, `catTo`
)
SELECT m.id, a.level_code, NULLIF(a.signatory, ''), a.title, a.tbl_unit_id, a.tbl_group_id, a.effdate, l.cat_from, l.cat_to
FROM `tbl_decision_assignment` a
INNER JOIN `tbl_decision_level` l ON l.code = a.level_code
INNER JOIN `tbl_official_memo` m ON m.code IN (
  'APPRAISAL', 'PERMISSION', 'ABANDONMENT', 'ATTESTATION', 'CERTIFICATE_OF_SERVICE'
)
WHERE NOT EXISTS (
  SELECT 1 FROM `tbl_official_memo_signatory` s WHERE s.memo_id = m.id
);

INSERT INTO `tbl_official_memo_signatory` (
  `memo_id`, `level_code`, `signatory`, `title`, `tbl_unit_id`, `tbl_group_id`, `effdate`, `catFrom`, `catTo`
)
SELECT m.id, a.level_code, NULLIF(a.signatory, ''), a.title, a.tbl_unit_id, a.tbl_group_id, a.effdate, 1, 12
FROM `tbl_decision_assignment` a
INNER JOIN `tbl_official_memo` m ON m.code = 'ALLOWANCE_ALLOCATION'
WHERE a.level_code = 'GM'
  AND NOT EXISTS (
    SELECT 1 FROM `tbl_official_memo_signatory` s WHERE s.memo_id = m.id
  );

INSERT INTO `tbl_official_memo_signatory` (
  `memo_id`, `level_code`, `signatory`, `title`, `tbl_unit_id`, `tbl_group_id`, `effdate`, `catFrom`, `catTo`
)
SELECT m.id, a.level_code, NULLIF(a.signatory, ''), a.title, a.tbl_unit_id, a.tbl_group_id, a.effdate, 1, 12
FROM `tbl_decision_assignment` a
INNER JOIN `tbl_official_memo` m ON m.code = 'COMMUNICATION'
WHERE a.level_code = 'UNIT_MANAGER'
  AND a.tbl_unit_id REGEXP '^[0-9]+$'
  AND CAST(a.tbl_unit_id AS UNSIGNED) = 160
  AND NOT EXISTS (
    SELECT 1 FROM `tbl_official_memo_signatory` s WHERE s.memo_id = m.id
  );

ALTER TABLE `tbl_official_memo_signatory`
  MODIFY `signatory` VARCHAR(255) NULL,
  MODIFY `catFrom` INTEGER NOT NULL,
  MODIFY `catTo` INTEGER NOT NULL;

UPDATE `tbl_decision_level` SET `title` = 'Estate / Unit' WHERE `code` = 'UNIT_MANAGER';
UPDATE `tbl_decision_level` SET `title` = 'Group' WHERE `code` = 'GROUP_MANAGER';

DROP TABLE `tbl_decision_assignment`;

ALTER TABLE `tbl_decision_level`
  DROP COLUMN `cat_from`,
  DROP COLUMN `cat_to`;
