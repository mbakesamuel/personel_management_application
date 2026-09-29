-- Optional employee photo, stored as a data URL. Null means show the initials avatar.
ALTER TABLE `tbl_employee` ADD COLUMN `image` LONGTEXT NULL;
