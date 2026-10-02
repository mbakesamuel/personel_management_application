-- Contact details are not required for every operator.
ALTER TABLE `tbl_operator` MODIFY `email` VARCHAR(191) NULL;
ALTER TABLE `tbl_operator` MODIFY `phone` VARCHAR(191) NULL;
ALTER TABLE `tbl_operator` MODIFY `address` VARCHAR(191) NULL;
