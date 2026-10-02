-- Zero dates (0000-00-00) make the MariaDB driver throw when registrations are listed.
UPDATE `fleet_registration`
SET `updatedAt` = `createdAt`
WHERE CAST(`updatedAt` AS CHAR) LIKE '0000%';

UPDATE `fleet_registration`
SET `effective_date` = `createdAt`
WHERE CAST(`effective_date` AS CHAR) LIKE '0000%';
