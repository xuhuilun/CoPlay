import { extname } from "node:path";
import type { CdnUploader, DownloadedVideo, UploadedRenditions } from "./cache-pipeline.js";

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
 * Optional CDN refresh/preheat step run after upload. A production implementation calls the
 * Aliyun CDN RefreshObjectCaches / PushObjectCache API; omitting it skips the step entirely.
 */
export interface CdnRefresher {
  refresh(url: string): Promise<void>;
}

export type OssCdnUploaderOptions = {
  bucket: string;
  region: string;
  internal?: boolean;
  /** Public CDN domain for playback URLs; falls back to the OSS bucket endpoint when unset. */
  cdnBaseUrl?: string;
  /** Multipart part size in bytes. Aliyun requires >= 100 KB; defaults to 1 MB. */
  partSize?: number;
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
 * Content-Type, returns a playable CDN rendition, and optionally triggers a CDN refresh.
 * Transcoding is out of scope, so a single "原画" rendition is returned.
 */
export class OssCdnUploader implements CdnUploader {
  constructor(
    private readonly client: OssClient,
    private readonly options: OssCdnUploaderOptions
  ) {}

  async upload(video: DownloadedVideo): Promise<UploadedRenditions> {
    if (!video.filePath) {
      throw new Error("cannot upload to OSS without a local artifact file");
    }
    const ext = extname(video.filePath).toLowerCase() || ".mp4";
    const objectKey = buildObjectKey(video.artifactId, ext);
    const partSize = Math.max(MIN_PART_SIZE, this.options.partSize ?? DEFAULT_PART_SIZE);

    const result = await this.client.putObjectMultipart(objectKey, video.filePath, {
      mime: resolveContentType(ext),
      partSize
    });

    const url = this.buildPlaybackUrl(result.name || objectKey);
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

export function buildObjectKey(artifactId: string, ext: string): string {
  const safeId = artifactId.replace(/[^A-Za-z0-9_-]/g, "_");
  return `videos/${safeId}/original${ext}`;
}

export function resolveContentType(ext: string): string {
  return CONTENT_TYPES[ext.toLowerCase()] ?? "application/octet-stream";
}
