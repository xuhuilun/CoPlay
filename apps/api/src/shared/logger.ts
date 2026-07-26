/**
 * Minimal structured-logging surface used by background workers. Pino (Fastify's `app.log`)
 * satisfies it structurally, so production logs are threaded through the real logger while
 * tests can inject a recorder and unconfigured/standalone use falls back to a no-op.
 */
export interface PipelineLogger {
  info(fields: Record<string, unknown>, message: string): void;
  error(fields: Record<string, unknown>, message: string): void;
}

export const noopLogger: PipelineLogger = {
  info() {},
  error() {}
};
