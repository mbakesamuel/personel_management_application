ALTER TABLE `tbl_permission_request`
  ADD COLUMN `startDate` DATETIME(3) NULL,
  ADD COLUMN `endDate` DATETIME(3) NULL;

UPDATE `tbl_permission_request`
SET `startDate` = `applicationDate`
WHERE `startDate` IS NULL;

ALTER TABLE `tbl_permission_request`
  MODIFY `startDate` DATETIME(3) NOT NULL;

CREATE TABLE `tbl_official_memo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(40) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `system` BOOLEAN NOT NULL DEFAULT false,
    `sort_order` INTEGER NOT NULL,

    UNIQUE INDEX `tbl_official_memo_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tbl_official_memo_signatory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `memo_id` INTEGER NOT NULL,
    `level_code` VARCHAR(30) NOT NULL,
    `signatory` VARCHAR(255) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `tbl_unit_id` VARCHAR(3) NULL,
    `tbl_group_id` VARCHAR(191) NULL,
    `effdate` DATETIME(0) NOT NULL,

    INDEX `tbl_official_memo_signatory_memo_id_idx`(`memo_id`),
    INDEX `tbl_official_memo_signatory_level_code_idx`(`level_code`),
    INDEX `tbl_official_memo_signatory_tbl_unit_id_idx`(`tbl_unit_id`),
    INDEX `tbl_official_memo_signatory_tbl_group_id_idx`(`tbl_group_id`),
    INDEX `tbl_official_memo_signatory_effdate_idx`(`effdate`),
    UNIQUE INDEX `uniq_memo_unit_effdate`(`memo_id`, `level_code`, `tbl_unit_id`, `effdate`),
    UNIQUE INDEX `uniq_memo_group_effdate`(`memo_id`, `level_code`, `tbl_group_id`, `effdate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `tbl_official_memo_signatory`
  ADD CONSTRAINT `tbl_official_memo_signatory_memo_id_fkey`
  FOREIGN KEY (`memo_id`) REFERENCES `tbl_official_memo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `tbl_official_memo_signatory`
  ADD CONSTRAINT `tbl_official_memo_signatory_level_code_fkey`
  FOREIGN KEY (`level_code`) REFERENCES `tbl_decision_level`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO `tbl_official_memo` (`code`, `name`, `system`, `sort_order`) VALUES
  ('LEAVE_APPROVAL', 'Leave approval', true, 1),
  ('PERMISSION', 'Permissions', true, 2),
  ('ABANDONMENT', 'Abandonment of work', true, 3),
  ('ATTESTATION', 'Attestation of service', true, 4),
  ('CERTIFICATE_OF_SERVICE', 'Certificate of service', true, 5);

INSERT INTO `tbl_official_memo_signatory` (
  `memo_id`, `level_code`, `signatory`, `title`, `tbl_unit_id`, `tbl_group_id`, `effdate`
)
SELECT m.id, a.level_code, a.signatory, a.title, a.tbl_unit_id, a.tbl_group_id, a.effdate
FROM `tbl_decision_assignment` a
INNER JOIN `tbl_official_memo` m ON m.code = 'LEAVE_APPROVAL';
