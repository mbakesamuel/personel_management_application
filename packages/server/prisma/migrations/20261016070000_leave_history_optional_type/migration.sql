-- Historic leave rows may exist without a grant; store leave type directly.
ALTER TABLE `tbl_employee_leave_history`
  ADD COLUMN `leaveTypeId` INTEGER NULL;

CREATE INDEX `tbl_employee_leave_history_leaveTypeId_idx`
  ON `tbl_employee_leave_history`(`leaveTypeId`);

UPDATE `tbl_employee_leave_history` h
INNER JOIN `tbl_leave_grant` g ON g.id = h.leaveGrantId
INNER JOIN `tbl_leave_request` r ON r.id = g.leaveRequestId
SET h.leaveTypeId = r.leaveTypeId
WHERE h.leaveTypeId IS NULL;

ALTER TABLE `tbl_employee_leave_history`
  ADD CONSTRAINT `tbl_employee_leave_history_leaveTypeId_fkey`
  FOREIGN KEY (`leaveTypeId`) REFERENCES `tbl_leave_type`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
