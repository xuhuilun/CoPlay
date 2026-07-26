import type { CacheJob as PrismaCacheJob, PrismaClient } from "@prisma/client";
import type { VideoStore } from "../videos/video.store.js";
import { describeCachedVideo } from "./bilibili.js";
import type { BilibiliDownloader, CdnUploader } from "./cache-pipeline.js";
import type { CacheJob } from "./cache-job.model.js";
import type { CacheJobNotifier } from "./cache-job.notifier.js";
import type { CacheJobStore } from "./cache-job.store.js";
import { SimulatedBilibiliDownloader, SimulatedCdnUploader } from "./simulated-cache-pipeline.js";

export class PrismaCacheJobRepository implements CacheJobStore {
  private readonly downloader: BilibiliDownloader;
  private readonly uploader: CdnUploader;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly videos: VideoStore,
    private readonly notifier?: CacheJobNotifier,
    pipeline?: { downloader?: BilibiliDownloader; uploader?: CdnUploader }
  ) {
    this.downloader = pipeline?.downloader ?? new SimulatedBilibiliDownloader();
    this.uploader = pipeline?.uploader ?? new SimulatedCdnUploader();
  }

  async create(sourceUrl: string): Promise<CacheJob> {
    // Reuse an in-flight or completed job for the same source to avoid duplicate
    // downloads and library entries; failed jobs are left out so retries can proceed.
    const reusable = await this.prisma.cacheJob.findFirst({
      where: { sourceUrl, status: { not: "failed" } },
      orderBy: { createdAt: "desc" }
    });
    if (reusable) {
      return toCacheJob(reusable);
    }
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
      const timer = setTimeout(() => {
        void this.advance(id, step);
      }, (index + 1) * 1300);
      timer.unref?.();
    });
  }

  private async advance(id: string, step: Pick<CacheJob, "status" | "progress" | "message">) {
    const job = await this.prisma.cacheJob.findUnique({ where: { id } });
    if (!job || job.status === "completed") {
      return;
    }

    let videoId = job.videoId;
    if (step.status === "completed") {
      const downloaded = await this.downloader.download(job.sourceUrl);
      const uploaded = await this.uploader.upload(downloaded);
      const meta = describeCachedVideo(job.sourceUrl, id);
      const video = await this.videos.addFromCache({
        title: meta.title,
        description: meta.description,
        posterUrl: uploaded.posterUrl,
        tags: ["bilibili", "cached"],
        sourceUrl: job.sourceUrl,
        hotScore: 78,
        durationSeconds: downloaded.durationSeconds,
        sources: uploaded.sources
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
