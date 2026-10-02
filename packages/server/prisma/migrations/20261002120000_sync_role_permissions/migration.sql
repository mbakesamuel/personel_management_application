UPDATE `tbl_roles`
SET `can_communication_allowance` = false
WHERE `code` IN ('BCA', 'BCO');

UPDATE `tbl_roles`
SET
  `can_appraisals` = false,
  `can_financial_years` = true,
  `can_communication_allowance` = true,
  `can_import_fleet` = true
WHERE `code` = 'NCM';

UPDATE `service`
SET `createdAt` = '2026-09-30 02:32:27.348',
    `updatedAt` = '2026-09-30 02:32:27.348'
WHERE `id` IN (1, 2);
