-- Every diploma lookup row has updatedAt 0000-00-00, which the driver cannot read.
UPDATE `tbl_diploma`
SET `updatedAt` = `createdAt`
WHERE CAST(`updatedAt` AS CHAR) LIKE '0000%';
