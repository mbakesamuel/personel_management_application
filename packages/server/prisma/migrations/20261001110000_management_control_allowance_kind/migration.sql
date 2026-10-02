-- Management-Control shows allowance figures instead of a welcome screen.
UPDATE `dashboard_group`
SET `kind` = 'ALLOWANCE'
WHERE `code` = 'MANAGEMENT_CONTROL';
