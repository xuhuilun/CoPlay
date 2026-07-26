-- AlterTable
ALTER TABLE `CacheJob`
  MODIFY `status` ENUM('queued', 'downloading', 'uploading', 'completed', 'failed', 'cancelled') NOT NULL DEFAULT 'queued';
