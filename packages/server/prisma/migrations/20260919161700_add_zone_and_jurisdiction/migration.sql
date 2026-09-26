-- CreateTable
CREATE TABLE `tbl_zone` (
    `id` VARCHAR(191) NOT NULL,
    `zone_name` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdat` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedat` DATETIME(3) NOT NULL,

    INDEX `tbl_zone_groupId_idx`(`groupId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_jurisdiction` (
    `code` VARCHAR(30) NOT NULL,
    `label` VARCHAR(120) NOT NULL,
    `rank` INTEGER NOT NULL,
    `scopeKind` VARCHAR(20) NOT NULL,
    `system` BOOLEAN NOT NULL DEFAULT false,
    `active` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed jurisdictions
INSERT INTO `tbl_jurisdiction` (`code`, `label`, `rank`, `scopeKind`, `system`, `active`) VALUES
('section', 'Section', 1, 'section', true, true),
('unit', 'Unit', 2, 'unit', true, true),
('zone', 'Zone', 3, 'zone', true, true),
('group', 'Group', 4, 'group', true, true),
('all', 'All', 5, 'all', true, true);

-- Default zones per existing group, then attach units
INSERT INTO `tbl_zone` (`id`, `zone_name`, `groupId`, `active`, `createdat`, `updatedat`)
SELECT CONCAT(g.`id`, '-Z01'), 'Default', g.`id`, true, NOW(3), NOW(3)
FROM `tbl_group` g;

-- AlterTable
ALTER TABLE `tbl_unit` ADD COLUMN `zoneId` VARCHAR(191) NULL;

UPDATE `tbl_unit` u
INNER JOIN `tbl_zone` z ON z.`groupId` = u.`groupid` AND z.`id` = CONCAT(u.`groupid`, '-Z01')
SET u.`zoneId` = z.`id`;

-- For units whose group has no zone row (orphan), create catch-all
INSERT INTO `tbl_zone` (`id`, `zone_name`, `groupId`, `active`, `createdat`, `updatedat`)
SELECT DISTINCT CONCAT(u.`groupid`, '-Z01'), 'Default', u.`groupid`, true, NOW(3), NOW(3)
FROM `tbl_unit` u
LEFT JOIN `tbl_zone` z ON z.`id` = CONCAT(u.`groupid`, '-Z01')
WHERE u.`zoneId` IS NULL AND z.`id` IS NULL AND u.`groupid` IS NOT NULL AND u.`groupid` <> '';

UPDATE `tbl_unit` u
SET u.`zoneId` = CONCAT(u.`groupid`, '-Z01')
WHERE u.`zoneId` IS NULL AND u.`groupid` IS NOT NULL AND u.`groupid` <> '';

-- Failsafe: any remaining null zoneId get a synthetic UNASSIGNED zone under first group or self
INSERT INTO `tbl_group` (`id`, `group_name`, `active`, `createdat`, `updatedat`)
SELECT '000', 'Unassigned', true, NOW(3), NOW(3)
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `tbl_group` WHERE `id` = '000')
  AND EXISTS (SELECT 1 FROM `tbl_unit` WHERE `zoneId` IS NULL);

INSERT INTO `tbl_zone` (`id`, `zone_name`, `groupId`, `active`, `createdat`, `updatedat`)
SELECT '000-Z01', 'Default', '000', true, NOW(3), NOW(3)
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `tbl_zone` WHERE `id` = '000-Z01')
  AND EXISTS (SELECT 1 FROM `tbl_unit` WHERE `zoneId` IS NULL);

UPDATE `tbl_unit` SET `groupid` = '000', `zoneId` = '000-Z01' WHERE `zoneId` IS NULL;

ALTER TABLE `tbl_unit` MODIFY `zoneId` VARCHAR(191) NOT NULL;

-- AlterTable users
ALTER TABLE `tbl_users` ADD COLUMN `tbl_zone_id` VARCHAR(191) NULL;
CREATE INDEX `tbl_users_tbl_zone_id_idx` ON `tbl_users`(`tbl_zone_id`);

-- Widen roles.jurisdiction
ALTER TABLE `tbl_roles` MODIFY `jurisdiction` VARCHAR(30) NOT NULL;

-- AddForeignKey
ALTER TABLE `tbl_zone` ADD CONSTRAINT `tbl_zone_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `tbl_group`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_unit` ADD CONSTRAINT `tbl_unit_zoneId_fkey` FOREIGN KEY (`zoneId`) REFERENCES `tbl_zone`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
