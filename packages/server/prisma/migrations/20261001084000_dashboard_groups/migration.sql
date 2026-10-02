-- Dashboard groups and the role that opens each one.
CREATE TABLE `dashboard_group` (
    `code` VARCHAR(40) NOT NULL,
    `label` VARCHAR(120) NOT NULL,
    `kind` VARCHAR(30) NOT NULL,
    `system` BOOLEAN NOT NULL DEFAULT false,
    `sort_order` INTEGER NOT NULL,

    PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `dashboard_group_role` (
    `role_code` VARCHAR(30) NOT NULL,
    `group_code` VARCHAR(40) NOT NULL,

    INDEX `dashboard_group_role_group_code_idx`(`group_code`),
    PRIMARY KEY (`role_code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `dashboard_group_role` ADD CONSTRAINT `dashboard_group_role_group_code_fkey` FOREIGN KEY (`group_code`) REFERENCES `dashboard_group`(`code`) ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO `dashboard_group` (`code`, `label`, `kind`, `system`, `sort_order`) VALUES
    ('HUMAN_RESOURCE', 'Human-Resource', 'HR', true, 1),
    ('MANAGEMENT_CONTROL', 'Management-Control', 'WELCOME', true, 2),
    ('NETWORK_COMMUNICATION', 'Network-Communication', 'COMMUNICATION', true, 3);
