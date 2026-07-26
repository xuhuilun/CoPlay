import { execFile } from "node:child_process";

export type CommandResult = {
  stdout: string;
  stderr: string;
  code: number;
};

/**
 * Runs an external command. Injected into command-backed adapters so their orchestration and
 * parsing can be unit-tested with a fake runner, never spawning a real process.
 */
export interface CommandRunner {
  run(command: string, args: string[]): Promise<CommandResult>;
}

const MAX_BUFFER = 64 * 1024 * 1024;

/**
 * Default runner backed by child_process.execFile. A non-zero exit resolves with its code so
 * callers can branch on it; a spawn failure (e.g. binary missing) rejects.
 */
export class SpawnCommandRunner implements CommandRunner {
  run(command: string, args: string[]): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      execFile(command, args, { maxBuffer: MAX_BUFFER }, (error, stdout, stderr) => {
        if (error && typeof (error as NodeJS.ErrnoException).code !== "number") {
          reject(error);
          return;
        }
        resolve({
          stdout: stdout.toString(),
          stderr: stderr.toString(),
          code: error ? Number((error as { code?: number }).code ?? 1) : 0
        });
      });
    });
  }
}
