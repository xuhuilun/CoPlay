import type { Awaitable } from "../../shared/awaitable.js";
import type { CacheJob, CacheJobStatus } from "./cache-job.model.js";

export type CacheJobListFilter = {
  status?: CacheJobStatus;
  limit?: number;
};

export type CacheJobStore = {
  create(sourceUrl: string, submitter: string): Awaitable<CacheJob>;
  findById(id: string): Awaitable<CacheJob | undefined>;
  list(filter?: CacheJobListFilter): Awaitable<CacheJob[]>;
  /** Re-run a failed or cancelled job. Returns undefined if missing or not retryable. */
  retry(id: string): Awaitable<CacheJob | undefined>;
  /** Cancel a non-terminal job. Returns undefined if missing or already terminal. */
  cancel(id: string): Awaitable<CacheJob | undefined>;
};

export const TERMINAL_STATUSES: readonly CacheJobStatus[] = ["completed", "failed", "cancelled"];

export function isTerminal(status: CacheJobStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * Thrown by `create` when a submitter has reached the rolling 24h cache-job limit. Routes
 * translate it into a 429 so an abusive client cannot run up OSS storage and CDN egress.
 */
export class CacheJobQuotaExceededError extends Error {
  constructor(
    readonly submitter: string,
    readonly limit: number
  ) {
    super(`Cache job quota exceeded for ${submitter} (limit ${limit})`);
    this.name = "CacheJobQuotaExceededError";
  }
}
