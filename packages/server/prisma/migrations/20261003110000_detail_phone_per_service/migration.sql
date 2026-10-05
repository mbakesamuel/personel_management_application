-- One phone per operator and service on a registration for a memo date.
-- Null phones are not covered by this index; the API checks those.
-- Keep the latest row when older history shares that key, so the unique index can be created.
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

CREATE UNIQUE INDEX `fleet_detail_operator_phone_service_date` ON `tbl_fleetRegDetails`(`fleetRegistrationId`, `operator_id`, `phoneNumber`, `serviceId`, `effective_date`);
