-- Change allowance rate id from string PK to auto-increment int (preserve rows)

CREATE TABLE `tbl_allowance_rate_new` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `allowanceId` VARCHAR(191) NOT NULL,
  `positionKeywordId` INTEGER NULL,
  `allowance_amt_min` DOUBLE NOT NULL,
  `allowance_amt_max` DOUBLE NOT NULL,
  `effectiveDate` DATETIME(3) NOT NULL,
  `workflowStatus` ENUM('PENDING', 'VALIDATED', 'REJECTED', 'SUPERSEDED') NOT NULL DEFAULT 'PENDING',
  `current` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdById` INTEGER NOT NULL,
  `updatedAt` DATETIME(3) NOT NULL,
  `updatedById` INTEGER NULL,
  `validatedAt` DATETIME(3) NULL,
  `validatedById` INTEGER NULL,
  `rejectedAt` DATETIME(3) NULL,
  `rejectedById` INTEGER NULL,
  `reviewNote` VARCHAR(191) NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `tbl_allowance_rate_new` (
  `allowanceId`,
  `positionKeywordId`,
  `allowance_amt_min`,
  `allowance_amt_max`,
  `effectiveDate`,
  `workflowStatus`,
  `current`,
  `createdAt`,
  `createdById`,
  `updatedAt`,
  `updatedById`,
  `validatedAt`,
  `validatedById`,
  `rejectedAt`,
  `rejectedById`,
  `reviewNote`
)
SELECT
  `allowanceId`,
  `positionKeywordId`,
  `allowance_amt_min`,
  `allowance_amt_max`,
  `effectiveDate`,
  `workflowStatus`,
  `current`,
  `createdAt`,
  `createdById`,
  `updatedAt`,
  `updatedById`,
  `validatedAt`,
  `validatedById`,
  `rejectedAt`,
  `rejectedById`,
  `reviewNote`
FROM `tbl_allowance_rate`
ORDER BY `createdAt` ASC, `id` ASC;

DROP TABLE `tbl_allowance_rate`;

RENAME TABLE `tbl_allowance_rate_new` TO `tbl_allowance_rate`;

CREATE INDEX `tbl_allowance_rate_allowanceId_idx` ON `tbl_allowance_rate`(`allowanceId`);
CREATE INDEX `tbl_allowance_rate_positionKeywordId_idx` ON `tbl_allowance_rate`(`positionKeywordId`);
CREATE INDEX `tbl_allowance_rate_allowanceId_positionKeywordId_idx` ON `tbl_allowance_rate`(`allowanceId`, `positionKeywordId`);
CREATE INDEX `tbl_allowance_rate_workflowStatus_idx` ON `tbl_allowance_rate`(`workflowStatus`);
CREATE INDEX `tbl_allowance_rate_allowanceId_effectiveDate_idx` ON `tbl_allowance_rate`(`allowanceId`, `effectiveDate`);

ALTER TABLE `tbl_allowance_rate`
  ADD CONSTRAINT `tbl_allowance_rate_allowanceId_fkey`
  FOREIGN KEY (`allowanceId`) REFERENCES `tbl_allowance`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `tbl_allowance_rate`
  ADD CONSTRAINT `tbl_allowance_rate_positionKeywordId_fkey`
  FOREIGN KEY (`positionKeywordId`) REFERENCES `tbl_position_keyword`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
