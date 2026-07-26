import { join } from "node:path";
import { parseBilibiliRef } from "./bilibili.js";
import type { BilibiliDownloader, DownloadedVideo } from "./cache-pipeline.js";
import { SpawnCommandRunner, type CommandRunner } from "./command-runner.js";

const DEFAULT_BINARY = "yt-dlp";
const DEFAULT_FORMAT = "best";
const DEFAULT_OUTPUT_DIR = "downloads";
const REMUX_FORMAT = "mp4";
const FALLBACK_POSTER =
  "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=1200&q=80";
const FALLBACK_DURATION = 30;

export type YtDlpConfig = {
  binaryPath?: string;
  format?: string;
  outputDir?: string;
};

/** Subset of yt-dlp's `--dump-single-json` output that this adapter consumes. */
export type YtDlpProbe = {
  id?: string;
  title?: string;
  duration?: number;
  thumbnail?: string;
};

/** Builds the args that probe a source for metadata without downloading. */
export function buildProbeArgs(sourceUrl: string): string[] {
  return ["--dump-single-json", "--no-playlist", sourceUrl];
}

/** Builds the args that download a source to the configured output template and format. */
export function buildDownloadArgs(
  sourceUrl: string,
  options: { outputTemplate: string; format: string; remuxFormat?: string }
): string[] {
  const args = ["--no-playlist", "-f", options.format, "-o", options.outputTemplate];
  if (options.remuxFormat) {
    args.push("--remux-video", options.remuxFormat);
  }
  args.push(sourceUrl);
  return args;
}

export function parseProbe(stdout: string): YtDlpProbe {
  const parsed: unknown = JSON.parse(stdout);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("yt-dlp probe output was not an object");
  }
  return parsed as YtDlpProbe;
}

/**
 * yt-dlp-backed implementation of {@link BilibiliDownloader}. Command construction and probe
 * parsing are pure and unit-tested; process execution goes through an injectable
 * {@link CommandRunner}. This is a wiring skeleton: enabling it in production requires the
 * yt-dlp binary and a real {@link CdnUploader} to publish the downloaded artifact.
 */
export class YtDlpBilibiliDownloader implements BilibiliDownloader {
  private readonly binary: string;
  private readonly format: string;
  private readonly outputDir: string;

  constructor(
    private readonly runner: CommandRunner = new SpawnCommandRunner(),
    config: YtDlpConfig = {}
  ) {
    this.binary = config.binaryPath ?? DEFAULT_BINARY;
    this.format = config.format ?? DEFAULT_FORMAT;
    this.outputDir = config.outputDir ?? DEFAULT_OUTPUT_DIR;
  }

  async download(sourceUrl: string): Promise<DownloadedVideo> {
    const probeResult = await this.runner.run(this.binary, buildProbeArgs(sourceUrl));
    if (probeResult.code !== 0) {
      throw new Error(`yt-dlp probe failed (${probeResult.code}): ${probeResult.stderr.trim()}`);
    }
    const probe = parseProbe(probeResult.stdout);

    const outputTemplate = join(this.outputDir, "%(id)s.%(ext)s");
    const downloadResult = await this.runner.run(
      this.binary,
      buildDownloadArgs(sourceUrl, { outputTemplate, format: this.format, remuxFormat: REMUX_FORMAT })
    );
    if (downloadResult.code !== 0) {
      throw new Error(`yt-dlp download failed (${downloadResult.code}): ${downloadResult.stderr.trim()}`);
    }

    const ref = parseBilibiliRef(sourceUrl);
    const duration = Math.round(probe.duration ?? 0);
    // Only a safe, known id lets us name the remuxed mp4 deterministically for the uploader.
    const safeId = probe.id ?? ref?.id;
    return {
      sourceUrl,
      ref,
      artifactId: probe.id ?? ref?.id ?? sourceUrl,
      durationSeconds: duration > 0 ? duration : FALLBACK_DURATION,
      posterUrl: probe.thumbnail ?? FALLBACK_POSTER,
      filePath: safeId ? join(this.outputDir, `${safeId}.${REMUX_FORMAT}`) : undefined
    };
  }
}
