-- Mark snapshot rows that should be drafted as a removal after an appointment is closed.
ALTER TABLE `tbl_communicatedFleetLine` ADD COLUMN `closure` BOOLEAN NOT NULL DEFAULT false;
