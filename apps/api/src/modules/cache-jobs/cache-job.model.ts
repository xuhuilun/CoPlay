export type CacheJobStatus = "queued" | "downloading" | "uploading" | "completed" | "failed";

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
