-- Mark registrations that are already on an inclusion letter.
ALTER TABLE `fleet_registration`
  ADD COLUMN `included_in_batch` BOOLEAN NOT NULL DEFAULT false;

UPDATE `fleet_registration` AS registration
INNER JOIN `tbl_operator` AS operator ON operator.`id` = registration.`operator_id`
SET registration.`included_in_batch` = true
WHERE registration.`end_date` IS NULL
  AND LOWER(operator.`name`) LIKE '%orange%';
