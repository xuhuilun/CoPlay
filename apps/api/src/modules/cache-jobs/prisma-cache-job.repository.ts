import type { CacheJob as PrismaCacheJob, PrismaClient } from "@prisma/client";
import { noopLogger, type PipelineLogger } from "../../shared/logger.js";
import type { VideoStore } from "../videos/video.store.js";
import { describeCachedVideo } from "./bilibili.js";
import type { BilibiliDownloader, CdnUploader } from "./cache-pipeline.js";
import type { CacheJobPipelineOptions } from "./cache-job.repository.js";
import type { CacheJob } from "./cache-job.model.js";
import type { CacheJobNotifier } from "./cache-job.notifier.js";
import { CacheJobQuotaExceededError, type CacheJobStore } from "./cache-job.store.js";
import { SimulatedBilibiliDownloader, SimulatedCdnUploader } from "./simulated-cache-pipeline.js";

const QUOTA_WINDOW_MS = 24 * 60 * 60 * 1000;

export class PrismaCacheJobRepository implements CacheJobStore {
  private readonly downloader: BilibiliDownloader;
  private readonly uploader: CdnUploader;
  private readonly logger: PipelineLogger;
  private readonly dailyQuota: number;
  private readonly now: () => number;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly videos: VideoStore,
    private readonly notifier?: CacheJobNotifier,
    options?: CacheJobPipelineOptions
  ) {
    this.downloader = options?.downloader ?? new SimulatedBilibiliDownloader();
    this.uploader = options?.uploader ?? new SimulatedCdnUploader();
    this.logger = options?.logger ?? noopLogger;
    this.dailyQuota = options?.dailyQuota ?? 0;
    this.now = options?.now ?? Date.now;
  }

  async create(sourceUrl: string, submitter: string): Promise<CacheJob> {
    // Reuse an in-flight or completed job for the same source to avoid duplicate
    // downloads and library entries; failed jobs are left out so retries can proceed.
    const reusable = await this.prisma.cacheJob.findFirst({
      where: { sourceUrl, status: { not: "failed" } },
      orderBy: { createdAt: "desc" }
    });
    if (reusable) {
      // Idempotent reuse never counts against the quota — no new work is created.
      return toCacheJob(reusable);
    }
    await this.enforceQuota(submitter);
    const job = await this.prisma.cacheJob.create({
      data: {
        sourceUrl,
        submitter,
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

  private async enforceQuota(submitter: string): Promise<void> {
    if (this.dailyQuota <= 0) {
      return;
    }
    const count = await this.prisma.cacheJob.count({
      where: { submitter, createdAt: { gte: new Date(this.now() - QUOTA_WINDOW_MS) } }
    });
    if (count >= this.dailyQuota) {
      throw new CacheJobQuotaExceededError(submitter, this.dailyQuota);
    }
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
      try {
        this.logger.info({ jobId: id, sourceUrl: job.sourceUrl, stage: "download" }, "cache pipeline: download");
        const downloaded = await this.downloader.download(job.sourceUrl);
        this.logger.info(
          { jobId: id, artifactId: downloaded.artifactId, stage: "upload" },
          "cache pipeline: upload"
        );
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
        this.logger.info(
          { jobId: id, videoId: video.id, url: uploaded.sources[0]?.url, stage: "completed" },
          "cache pipeline: completed"
        );
      } catch (error) {
        this.logger.error(
          { jobId: id, sourceUrl: job.sourceUrl, stage: "failed", err: errorMessage(error) },
          "cache pipeline: failed"
        );
        const failed = await this.prisma.cacheJob.update({
          where: { id },
          data: { status: "failed", message: `缓存失败：${errorMessage(error)}` }
        });
        this.notifier?.publish(toCacheJob(failed));
        return;
      }
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "未知错误";
}

function toCacheJob(job: PrismaCacheJob): CacheJob {
  return {
    id: job.id,
    sourceUrl: job.sourceUrl,
    status: job.status,
    progress: job.progress,
    message: job.message,
    videoId: job.videoId ?? undefined,
    submitter: job.submitter,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString()
  };
}
