-- AlterTable
ALTER TABLE `CacheJob` ADD COLUMN `submitter` VARCHAR(160) NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX `CacheJob_submitter_createdAt_idx` ON `CacheJob`(`submitter`, `createdAt`);
