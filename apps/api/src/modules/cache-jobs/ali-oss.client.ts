import OSS from "ali-oss";
import type { OssClient, OssMultipartOptions, OssPutResult } from "./oss-cdn.uploader.js";

export type AliOssClientConfig = {
  accessKeyId: string;
  accessKeySecret: string;
  bucket: string;
  region: string;
  /** Use the intranet endpoint (oss-<region>-internal) when running inside the same region. */
  internal?: boolean;
  /** Explicit endpoint override; when set it takes precedence over region/internal. */
  endpoint?: string;
};

/**
 * Production {@link OssClient} backed by the official ali-oss SDK. Multipart upload and the
 * intranet/extranet endpoint switch are delegated to the SDK; only the thin mapping lives here,
 * so the rest of the pipeline stays testable without credentials.
 */
export class AliOssClient implements OssClient {
  private readonly client: OSS;

  constructor(config: AliOssClientConfig) {
    this.client = new OSS({
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
      bucket: config.bucket,
      region: normalizeRegion(config.region),
      internal: config.internal,
      endpoint: config.endpoint,
      secure: true
    });
  }

  async putObjectMultipart(
    objectKey: string,
    filePath: string,
    options: OssMultipartOptions
  ): Promise<OssPutResult> {
    const result = await this.client.multipartUpload(objectKey, filePath, {
      partSize: options.partSize,
      mime: options.mime
    });
    const name = (result as { name?: string }).name;
    return { name: name ?? objectKey };
  }
}

/** ali-oss expects a region id like `oss-cn-hongkong`; accept either form from config. */
export function normalizeRegion(region: string): string {
  return region.startsWith("oss-") ? region : `oss-${region}`;
}
