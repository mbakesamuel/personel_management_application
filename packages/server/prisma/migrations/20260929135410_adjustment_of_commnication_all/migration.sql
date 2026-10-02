/*
  Warnings:

  - You are about to drop the column `country` on the `tbl_operator` table. All the data in the column will be lost.
  - You are about to drop the `fleet_payment` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `accountNo` to the `fleet_registration` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `fleet_registration` ADD COLUMN `accountNo` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `tbl_operator` DROP COLUMN `country`;

-- DropTable
DROP TABLE `fleet_payment`;
