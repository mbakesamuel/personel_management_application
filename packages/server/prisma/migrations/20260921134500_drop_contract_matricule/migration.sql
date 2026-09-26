-- DropForeignKey
ALTER TABLE `tbl_emp_contract` DROP FOREIGN KEY `tbl_emp_contract_matricule_fkey`;

-- DropIndex
DROP INDEX `tbl_emp_contract_matricule_idx` ON `tbl_emp_contract`;

-- AlterTable
ALTER TABLE `tbl_emp_contract` DROP COLUMN `matricule`;
