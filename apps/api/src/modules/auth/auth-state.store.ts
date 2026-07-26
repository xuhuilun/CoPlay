import type { Awaitable } from "../../shared/awaitable.js";

/** Result of validating an OAuth `state` value at callback time. */
export type AuthStateOutcome = "valid" | "expired" | "unknown";

/**
 * Stores the short-lived, single-use `state` values minted when a login flow starts, so the
 * callback can defend against CSRF and replay. A Redis-backed implementation can replace the
 * in-memory one for multi-instance deployments.
 */
export interface AuthStateStore {
  issue(state: string): Awaitable<void>;
  /** Validates and consumes a state. Returns `unknown` for missing/replayed, `expired` past TTL. */
  consume(state: string): Awaitable<AuthStateOutcome>;
}

const DEFAULT_TTL_MS = 10 * 60 * 1000;

export class MemoryAuthStateStore implements AuthStateStore {
  private readonly states = new Map<string, number>();

  constructor(
    private readonly ttlMs: number = DEFAULT_TTL_MS,
    private readonly now: () => number = Date.now
  ) {}

  issue(state: string): void {
    this.states.set(state, this.now() + this.ttlMs);
  }

  consume(state: string): AuthStateOutcome {
    const expiresAt = this.states.get(state);
    if (expiresAt === undefined) {
      return "unknown";
    }
    // Single-use: consume regardless of expiry so a replayed state can never validate.
    this.states.delete(state);
    return this.now() >= expiresAt ? "expired" : "valid";
  }
}
