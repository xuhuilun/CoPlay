import type { CacheJob, CacheJobStatus } from "../cache-jobs/cache-job.model.js";

export type SubmitterUsage = {
  submitter: string;
  total: number;
  completed: number;
  failed: number;
};

export type UsageReport = {
  jobs: {
    total: number;
    byStatus: Record<CacheJobStatus, number>;
  };
  librarySize: number;
  topSubmitters: SubmitterUsage[];
};

const STATUSES: CacheJobStatus[] = ["queued", "downloading", "uploading", "completed", "failed", "cancelled"];
const TOP_SUBMITTERS = 20;

/**
 * Aggregates operational usage from what the stores actually hold: job counts by status,
 * the cached library size, and per-submitter task counts (top N). Real OSS byte usage is
 * not included — it requires the Aliyun OSS BucketStat API and is deliberately left out
 * rather than estimated.
 */
export function computeUsage(jobs: CacheJob[], librarySize: number): UsageReport {
  const byStatus = Object.fromEntries(STATUSES.map((status) => [status, 0])) as Record<CacheJobStatus, number>;
  const bySubmitter = new Map<string, SubmitterUsage>();

  for (const job of jobs) {
    byStatus[job.status] += 1;
    const usage = bySubmitter.get(job.submitter) ?? { submitter: job.submitter, total: 0, completed: 0, failed: 0 };
    usage.total += 1;
    if (job.status === "completed") {
      usage.completed += 1;
    } else if (job.status === "failed") {
      usage.failed += 1;
    }
    bySubmitter.set(job.submitter, usage);
  }

  const topSubmitters = [...bySubmitter.values()]
    .sort((a, b) => b.total - a.total || a.submitter.localeCompare(b.submitter))
    .slice(0, TOP_SUBMITTERS);

  return {
    jobs: { total: jobs.length, byStatus },
    librarySize,
    topSubmitters
  };
}
