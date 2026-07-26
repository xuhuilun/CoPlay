import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Same clip encoded at two resolutions so the quality selector is demonstrable end-to-end.
const demoSources = [
  { id: "720p", label: "720P 高清", url: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4" },
  { id: "360p", label: "360P 流畅", url: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4" }
];

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
    const data = {
      ...video,
      sourcesJson: demoSources,
      cdnUrl: demoSources[0].url
    };
    await prisma.video.upsert({
      where: { title: video.title },
      update: data,
      create: {
        ...data,
        source: "bilibili",
        sourceUrl: "https://www.bilibili.com",
        durationSeconds: 30
      }
    });
  }
}

await main();
await prisma.$disconnect();
