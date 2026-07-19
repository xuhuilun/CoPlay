-- CreateTable
CREATE TABLE `Video` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(180) NOT NULL,
    `description` TEXT NOT NULL,
    `source` ENUM('bilibili', 'library') NOT NULL,
    `sourceUrl` VARCHAR(512) NOT NULL,
    `cdnUrl` VARCHAR(512) NOT NULL,
    `posterUrl` VARCHAR(512) NOT NULL,
    `durationSeconds` INTEGER NOT NULL,
    `tagsJson` JSON NOT NULL,
    `hotScore` INTEGER NOT NULL DEFAULT 0,
    `cachedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Video_title_key`(`title`),
    INDEX `Video_hotScore_idx`(`hotScore`),
    INDEX `Video_cachedAt_idx`(`cachedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CacheJob` (
    `id` VARCHAR(191) NOT NULL,
    `sourceUrl` VARCHAR(512) NOT NULL,
    `status` ENUM('queued', 'downloading', 'uploading', 'completed', 'failed') NOT NULL DEFAULT 'queued',
    `progress` INTEGER NOT NULL DEFAULT 0,
    `message` VARCHAR(255) NOT NULL,
    `videoId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CacheJob_status_idx`(`status`),
    INDEX `CacheJob_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Room` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('couple', 'screening') NOT NULL,
    `videoId` VARCHAR(191) NOT NULL,
    `hostGuestId` VARCHAR(80) NOT NULL,
    `maxMembers` INTEGER NOT NULL,
    `currentTime` DOUBLE NOT NULL DEFAULT 0,
    `paused` BOOLEAN NOT NULL DEFAULT true,
    `playbackRate` DOUBLE NOT NULL DEFAULT 1,
    `stateUpdatedBy` VARCHAR(80) NOT NULL,
    `stateUpdatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Room_videoId_idx`(`videoId`),
    INDEX `Room_hostGuestId_idx`(`hostGuestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RoomMember` (
    `id` VARCHAR(191) NOT NULL,
    `roomId` VARCHAR(191) NOT NULL,
    `guestId` VARCHAR(80) NOT NULL,
    `nickname` VARCHAR(80) NOT NULL,
    `role` ENUM('host', 'member') NOT NULL,
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RoomMember_guestId_idx`(`guestId`),
    UNIQUE INDEX `RoomMember_roomId_guestId_key`(`roomId`, `guestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CacheJob` ADD CONSTRAINT `CacheJob_videoId_fkey` FOREIGN KEY (`videoId`) REFERENCES `Video`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Room` ADD CONSTRAINT `Room_videoId_fkey` FOREIGN KEY (`videoId`) REFERENCES `Video`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RoomMember` ADD CONSTRAINT `RoomMember_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `Room`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
