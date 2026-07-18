export type CacheJobStatus = "queued" | "downloading" | "uploading" | "completed" | "failed";

export type CacheJob = {
  id: string;
  sourceUrl: string;
  status: CacheJobStatus;
  progress: number;
  message: string;
  videoId?: string;
  createdAt: string;
  updatedAt: string;
};
