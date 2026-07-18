import type { CacheJob as PrismaCacheJob, PrismaClient } from "@prisma/client";
import type { VideoStore } from "../videos/video.store.js";
import type { CacheJob } from "./cache-job.model.js";
import type { CacheJobNotifier } from "./cache-job.notifier.js";
import type { CacheJobStore } from "./cache-job.store.js";

const posterUrl =
  "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=1200&q=80";

export class PrismaCacheJobRepository implements CacheJobStore {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly videos: VideoStore,
    private readonly notifier?: CacheJobNotifier
  ) {}

  async create(sourceUrl: string): Promise<CacheJob> {
    const job = await this.prisma.cacheJob.create({
      data: {
        sourceUrl,
        status: "queued",
        progress: 5,
        message: "缓存任务已创建，等待下载。"
      }
    });
    this.simulate(job.id);
    const cacheJob = toCacheJob(job);
    this.notifier?.publish(cacheJob);
    return cacheJob;
  }

  async findById(id: string): Promise<CacheJob | undefined> {
    const job = await this.prisma.cacheJob.findUnique({ where: { id } });
    return job ? toCacheJob(job) : undefined;
  }

  private simulate(id: string) {
    const steps: Array<Pick<CacheJob, "status" | "progress" | "message">> = [
      { status: "downloading", progress: 28, message: "正在从 B 站拉取视频元数据。" },
      { status: "downloading", progress: 62, message: "正在缓存视频文件。" },
      { status: "uploading", progress: 86, message: "正在上传到 CDN。" },
      { status: "completed", progress: 100, message: "缓存完成，已加入视频库。" }
    ];

    steps.forEach((step, index) => {
      setTimeout(() => {
        void this.advance(id, step);
      }, (index + 1) * 1300);
    });
  }

  private async advance(id: string, step: Pick<CacheJob, "status" | "progress" | "message">) {
    const job = await this.prisma.cacheJob.findUnique({ where: { id } });
    if (!job || job.status === "completed") {
      return;
    }

    let videoId = job.videoId;
    if (step.status === "completed") {
      const video = await this.videos.addFromCache({
        title: `B站缓存视频 ${id.slice(-6)}`,
        description: "由用户提交链接后缓存到 CDN 的视频。",
        posterUrl,
        tags: ["bilibili", "cached"],
        sourceUrl: job.sourceUrl,
        hotScore: 78
      });
      videoId = video.id;
    }

    const updated = await this.prisma.cacheJob.update({
      where: { id },
      data: {
        status: step.status,
        progress: step.progress,
        message: step.message,
        videoId
      }
    });
    this.notifier?.publish(toCacheJob(updated));
  }
}

function toCacheJob(job: PrismaCacheJob): CacheJob {
  return {
    id: job.id,
    sourceUrl: job.sourceUrl,
    status: job.status,
    progress: job.progress,
    message: job.message,
    videoId: job.videoId ?? undefined,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString()
  };
}
