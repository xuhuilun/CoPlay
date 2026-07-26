import { extname } from "node:path";
import type { CdnUploader, DownloadedVideo, UploadedRenditions } from "./cache-pipeline.js";
import { FileSha256Digest } from "./content-digest.js";

/** Result of a multipart put, exposing the stored object key. */
export type OssPutResult = { name: string };

export type OssMultipartOptions = {
  mime: string;
  partSize: number;
};

/**
 * Minimal object-storage surface used by {@link OssCdnUploader}. Injected so the upload
 * orchestration is unit-tested without credentials or network. Implemented for production by
 * the ali-oss-backed adapter, which performs the actual multipart upload.
 */
export interface OssClient {
  putObjectMultipart(objectKey: string, filePath: string, options: OssMultipartOptions): Promise<OssPutResult>;
}

/**
 * Optional CDN refresh/preheat step. Retained as a seam but intentionally not wired: because
 * object keys are content-addressed (a URL always maps to identical bytes), the CDN can cache
 * forever and never serves stale content, so a refresh is not needed by design. A production
 * implementation would call the Aliyun CDN RefreshObjectCaches / PushObjectCache API.
 */
export interface CdnRefresher {
  refresh(url: string): Promise<void>;
}

/** Computes a stable content digest for an artifact file, used to build immutable keys. */
export interface ContentDigest {
  compute(filePath: string): Promise<string>;
}

export type OssCdnUploaderOptions = {
  bucket: string;
  region: string;
  internal?: boolean;
  /** Public CDN domain for playback URLs; falls back to the OSS bucket endpoint when unset. */
  cdnBaseUrl?: string;
  /** Multipart part size in bytes. Aliyun requires >= 100 KB; defaults to 1 MB. */
  partSize?: number;
  digest?: ContentDigest;
  refresher?: CdnRefresher;
};

const DEFAULT_PART_SIZE = 1024 * 1024;
const MIN_PART_SIZE = 100 * 1024;

const CONTENT_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".m4v": "video/x-m4v",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".mov": "video/quicktime",
  ".flv": "video/x-flv",
  ".ts": "video/mp2t"
};

/**
 * Publishes a downloaded artifact to Aliyun OSS via multipart upload with the correct
 * Content-Type and returns a playable CDN rendition. Object keys are content-addressed
 * (`videos/<artifactId>/<contentDigest>.<ext>`) so every distinct upload lands at a unique,
 * immutable URL — the CDN can cache it indefinitely and never serves stale content, which
 * removes the need for a cache refresh by design. Transcoding is out of scope, so a single
 * "原画" rendition is returned.
 */
export class OssCdnUploader implements CdnUploader {
  private readonly digest: ContentDigest;

  constructor(
    private readonly client: OssClient,
    private readonly options: OssCdnUploaderOptions
  ) {
    this.digest = options.digest ?? new FileSha256Digest();
  }

  async upload(video: DownloadedVideo): Promise<UploadedRenditions> {
    const filePath = video.filePath;
    if (!filePath) {
      throw new Error("cannot upload to OSS without a local artifact file");
    }
    const ext = extname(filePath).toLowerCase() || ".mp4";
    // Label each seam's failure so the worker log pinpoints hash vs upload.
    const version = await labelSeam("content digest failed", () => this.digest.compute(filePath));
    const objectKey = buildObjectKey(video.artifactId, version, ext);
    const partSize = Math.max(MIN_PART_SIZE, this.options.partSize ?? DEFAULT_PART_SIZE);

    const result = await labelSeam("oss multipart upload failed", () =>
      this.client.putObjectMultipart(objectKey, filePath, {
        mime: resolveContentType(ext),
        partSize
      })
    );

    const url = this.buildPlaybackUrl(result.name || objectKey);
    // Retained seam; content-addressed keys make it unnecessary, so it is off unless injected.
    if (this.options.refresher) {
      await this.options.refresher.refresh(url);
    }

    return {
      posterUrl: video.posterUrl,
      sources: [{ id: "auto", label: "原画", url }]
    };
  }

  private buildPlaybackUrl(objectKey: string): string {
    if (this.options.cdnBaseUrl) {
      return `${this.options.cdnBaseUrl.replace(/\/$/, "")}/${objectKey}`;
    }
    const suffix = this.options.internal ? "-internal" : "";
    const host = `${this.options.bucket}.oss-${this.options.region}${suffix}.aliyuncs.com`;
    return `https://${host}/${objectKey}`;
  }
}

async function labelSeam<T>(label: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${label}: ${detail}`);
  }
}

export function buildObjectKey(artifactId: string, version: string, ext: string): string {
  const safeId = artifactId.replace(/[^A-Za-z0-9_-]/g, "_");
  const safeVersion = version.replace(/[^A-Za-z0-9_-]/g, "_");
  return `videos/${safeId}/${safeVersion}${ext}`;
}

export function resolveContentType(ext: string): string {
  return CONTENT_TYPES[ext.toLowerCase()] ?? "application/octet-stream";
}
