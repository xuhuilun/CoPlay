import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const videos = [
  {
    title: "星港夜航",
    description: "适合放映厅测试的城市夜景样片。",
    posterUrl:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
    tagsJson: ["city", "night", "demo"],
    hotScore: 96
  },
  {
    title: "花园短片",
    description: "轻量级同步播放测试视频。",
    posterUrl:
      "https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=1200&q=80",
    tagsJson: ["nature", "short", "demo"],
    hotScore: 91
  },
  {
    title: "海岸慢镜",
    description: "用于情侣房间进度同步验证。",
    posterUrl:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
    tagsJson: ["ocean", "sync", "demo"],
    hotScore: 87
  }
];

async function main() {
  for (const video of videos) {
    await prisma.video.upsert({
      where: { title: video.title },
      update: video,
      create: {
        ...video,
        source: "bilibili",
        sourceUrl: "https://www.bilibili.com",
        cdnUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
        durationSeconds: 30
      }
    });
  }
}

await main();
await prisma.$disconnect();
