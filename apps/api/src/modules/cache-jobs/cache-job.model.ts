export type CacheJobStatus =
  | "queued"
  | "downloading"
  | "uploading"
  | "completed"
  | "failed"
  | "cancelled";

export type CacheJob = {
  id: string;
  sourceUrl: string;
  status: CacheJobStatus;
  progress: number;
  message: string;
  videoId?: string;
  /** Identity of who submitted the job — `user:<id>` when authenticated, else `ip:<addr>`. */
  submitter: string;
  createdAt: string;
  updatedAt: string;
};

/** A cache job without the `submitter` field, safe to return to non-admin clients. */
export type PublicCacheJob = Omit<CacheJob, "submitter">;

/** Strips submitter identity (which includes client IPs) before crossing the public boundary. */
export function toPublicCacheJob(job: CacheJob): PublicCacheJob {
  const { submitter: _submitter, ...rest } = job;
  return rest;
}
