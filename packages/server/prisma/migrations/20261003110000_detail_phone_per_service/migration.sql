-- One phone per operator and service on a registration for a memo date.
-- Null phones are not covered by this index; the API checks those.
CREATE UNIQUE INDEX `fleet_detail_operator_phone_service_date` ON `tbl_fleetRegDetails`(`fleetRegistrationId`, `operator_id`, `phoneNumber`, `serviceId`, `effective_date`);
