-- Keep the latest row for each registration, operator, phone, and service.
DELETE d
FROM `tbl_fleetRegDetails` d
INNER JOIN `tbl_fleetRegDetails` newer
  ON d.fleetRegistrationId = newer.fleetRegistrationId
 AND d.operator_id = newer.operator_id
 AND d.serviceId = newer.serviceId
 AND d.phoneNumber <=> newer.phoneNumber
 AND (
   d.effective_date < newer.effective_date
   OR (d.effective_date = newer.effective_date AND d.id < newer.id)
 );

DROP INDEX `tbl_fleetRegDetails_fleetRegistrationId_serviceId_effective__idx` ON `tbl_fleetRegDetails`;

DROP INDEX `tbl_fleetRegDetails_phoneNumber_operator_AccountId_serviceId_key` ON `tbl_fleetRegDetails`;

ALTER TABLE `tbl_fleetRegistration`
  CHANGE `effective_date` `appointment_date` DATETIME(3) NOT NULL;

ALTER TABLE `tbl_fleetRegDetails` DROP COLUMN `effective_date`;

CREATE INDEX `tbl_fleetRegDetails_fleetRegistrationId_serviceId_idx` ON `tbl_fleetRegDetails`(`fleetRegistrationId`, `serviceId`);

CREATE UNIQUE INDEX `tbl_fleetRegDetails_phoneNumber_operator_AccountId_serviceId_key` ON `tbl_fleetRegDetails`(`phoneNumber`, `operator_AccountId`, `serviceId`, `amount`);

CREATE UNIQUE INDEX `fleet_detail_operator_phone_service_date` ON `tbl_fleetRegDetails`(`fleetRegistrationId`, `operator_id`, `phoneNumber`, `serviceId`);
