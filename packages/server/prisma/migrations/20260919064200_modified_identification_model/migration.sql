/*
  Warnings:

  - You are about to drop the column `idDate` on the `empidenditifcation` table. All the data in the column will be lost.
  - You are about to drop the column `idPlace` on the `empidenditifcation` table. All the data in the column will be lost.
  - You are about to drop the column `idType` on the `empidenditifcation` table. All the data in the column will be lost.
  - You are about to drop the column `idValidity` on the `empidenditifcation` table. All the data in the column will be lost.
  - Added the required column `date_expiry` to the `EmpIdenditifcation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `date_issue` to the `EmpIdenditifcation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `place_issue` to the `EmpIdenditifcation` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `empidenditifcation` DROP COLUMN `idDate`,
    DROP COLUMN `idPlace`,
    DROP COLUMN `idType`,
    DROP COLUMN `idValidity`,
    ADD COLUMN `date_expiry` DATETIME(3) NOT NULL,
    ADD COLUMN `date_issue` DATETIME(3) NOT NULL,
    ADD COLUMN `place_issue` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE INDEX `EmpIdenditifcation_workflowStatus_idx` ON `EmpIdenditifcation`(`workflowStatus`);

-- RenameIndex
ALTER TABLE `empidenditifcation` RENAME INDEX `EmpIdenditifcation_matricule_fkey` TO `EmpIdenditifcation_matricule_idx`;
