-- Dedicated permission for managing communication allowance.
ALTER TABLE `tbl_roles`
  ADD COLUMN `can_communication_allowance` BOOLEAN NOT NULL DEFAULT false;

-- Roles that can already open the screen keep access. Administrator always has it.
UPDATE `tbl_roles`
SET `can_communication_allowance` = true
WHERE `code` = 'ADMINISTRATOR'
   OR (
     `can_allowances` = true
     AND (
       `can_allowance_types` = true
       OR `can_allowance_catalog` = true
       OR `can_allowance_rates` = true
       OR `can_allowance_allocations` = true
     )
   );
