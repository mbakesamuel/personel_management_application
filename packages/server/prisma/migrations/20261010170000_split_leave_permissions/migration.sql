ALTER TABLE `tbl_roles`
  ADD COLUMN `can_permission_requests` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `can_leave_requests` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `can_leave_due` BOOLEAN NOT NULL DEFAULT false;

UPDATE `tbl_roles`
SET
  `can_permission_requests` = `can_leave`,
  `can_leave_requests` = `can_leave`,
  `can_leave_due` = `can_leave`;
