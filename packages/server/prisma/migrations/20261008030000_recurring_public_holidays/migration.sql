-- Public holidays repeat every year, so only the month and day are stored.
ALTER TABLE `tbl_public_holiday`
  ADD COLUMN `month` INTEGER NULL,
  ADD COLUMN `day` INTEGER NULL;

UPDATE `tbl_public_holiday`
SET `month` = MONTH(`holidayDate`),
    `day` = DAY(`holidayDate`);

DELETE `h1` FROM `tbl_public_holiday` `h1`
INNER JOIN `tbl_public_holiday` `h2`
  ON `h1`.`month` = `h2`.`month`
 AND `h1`.`day` = `h2`.`day`
 AND `h1`.`id` > `h2`.`id`;

ALTER TABLE `tbl_public_holiday`
  DROP INDEX `tbl_public_holiday_holidayDate_key`,
  DROP COLUMN `holidayDate`,
  MODIFY `month` INTEGER NOT NULL,
  MODIFY `day` INTEGER NOT NULL,
  ADD UNIQUE INDEX `tbl_public_holiday_month_day_key`(`month`, `day`);

INSERT INTO `tbl_public_holiday` (`month`, `day`, `name`, `active`)
SELECT 1, 1, 'New Year''s Day', true
WHERE NOT EXISTS (SELECT 1 FROM `tbl_public_holiday` WHERE `month` = 1 AND `day` = 1);

INSERT INTO `tbl_public_holiday` (`month`, `day`, `name`, `active`)
SELECT 2, 11, 'Youth Day', true
WHERE NOT EXISTS (SELECT 1 FROM `tbl_public_holiday` WHERE `month` = 2 AND `day` = 11);

INSERT INTO `tbl_public_holiday` (`month`, `day`, `name`, `active`)
SELECT 5, 1, 'Labour Day', true
WHERE NOT EXISTS (SELECT 1 FROM `tbl_public_holiday` WHERE `month` = 5 AND `day` = 1);

INSERT INTO `tbl_public_holiday` (`month`, `day`, `name`, `active`)
SELECT 5, 20, 'National Day', true
WHERE NOT EXISTS (SELECT 1 FROM `tbl_public_holiday` WHERE `month` = 5 AND `day` = 20);

INSERT INTO `tbl_public_holiday` (`month`, `day`, `name`, `active`)
SELECT 8, 15, 'Assumption Day', true
WHERE NOT EXISTS (SELECT 1 FROM `tbl_public_holiday` WHERE `month` = 8 AND `day` = 15);

INSERT INTO `tbl_public_holiday` (`month`, `day`, `name`, `active`)
SELECT 12, 25, 'Christmas Day', true
WHERE NOT EXISTS (SELECT 1 FROM `tbl_public_holiday` WHERE `month` = 12 AND `day` = 25);
