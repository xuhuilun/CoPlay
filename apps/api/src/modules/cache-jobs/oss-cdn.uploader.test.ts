import assert from "node:assert/strict";
import test from "node:test";
import type { DownloadedVideo } from "./cache-pipeline.js";
import {
  buildObjectKey,
  OssCdnUploader,
  resolveContentType,
  type CdnRefresher,
  type OssClient,
  type OssMultipartOptions,
  type OssPutResult
} from "./oss-cdn.uploader.js";

function downloaded(overrides: Partial<DownloadedVideo> = {}): DownloadedVideo {
  return {
    sourceUrl: "https://www.bilibili.com/video/BV1xx411c7mD",
    ref: { kind: "bv", id: "BV1xx411c7mD" },
    artifactId: "BV1xx411c7mD",
    durationSeconds: 128,
    posterUrl: "https://poster/1.jpg",
    filePath: "downloads/BV1xx411c7mD.mp4",
    ...overrides
  };
}

test("object key and content type helpers are correct", () => {
  assert.equal(buildObjectKey("BV1xx411c7mD", ".mp4"), "videos/BV1xx411c7mD/original.mp4");
  assert.equal(buildObjectKey("a/b c", ".mp4"), "videos/a_b_c/original.mp4");
  assert.equal(resolveContentType(".mp4"), "video/mp4");
  assert.equal(resolveContentType(".WEBM"), "video/webm");
  assert.equal(resolveContentType(".xyz"), "application/octet-stream");
});

test("upload sends a multipart put with the correct content type and returns a CDN url", async () => {
  const client = new FakeOssClient();
  const uploader = new OssCdnUploader(client, {
    bucket: "bilisync",
    region: "cn-hongkong",
    cdnBaseUrl: "https://cdn.bilisync.top"
  });

  const result = await uploader.upload(downloaded());

  assert.equal(client.calls.length, 1);
  assert.equal(client.calls[0].objectKey, "videos/BV1xx411c7mD/original.mp4");
  assert.equal(client.calls[0].filePath, "downloads/BV1xx411c7mD.mp4");
  assert.equal(client.calls[0].options.mime, "video/mp4");
  assert.equal(result.posterUrl, "https://poster/1.jpg");
  assert.deepEqual(result.sources, [
    { id: "auto", label: "原画", url: "https://cdn.bilisync.top/videos/BV1xx411c7mD/original.mp4" }
  ]);
});

test("upload falls back to the OSS bucket endpoint with intranet switching", async () => {
  const external = new OssCdnUploader(new FakeOssClient(), { bucket: "bilisync", region: "cn-hongkong" });
  const internal = new OssCdnUploader(new FakeOssClient(), {
    bucket: "bilisync",
    region: "cn-hongkong",
    internal: true
  });

  const externalResult = await external.upload(downloaded());
  const internalResult = await internal.upload(downloaded());

  assert.equal(
    externalResult.sources[0].url,
    "https://bilisync.oss-cn-hongkong.aliyuncs.com/videos/BV1xx411c7mD/original.mp4"
  );
  assert.equal(
    internalResult.sources[0].url,
    "https://bilisync.oss-cn-hongkong-internal.aliyuncs.com/videos/BV1xx411c7mD/original.mp4"
  );
});

test("upload chunks a large file into multiple parts using the configured part size", async () => {
  const client = new FakeOssClient({ fileSizeByPath: { "downloads/BV1xx411c7mD.mp4": 50 * 1024 * 1024 } });
  const uploader = new OssCdnUploader(client, { bucket: "bilisync", region: "cn-hongkong" });

  await uploader.upload(downloaded());

  assert.equal(client.calls[0].options.partSize, 1024 * 1024); // default 1 MB
  assert.equal(client.lastParts, 50); // 50 MB / 1 MB => 50 parts
});

test("upload enforces the Aliyun minimum part size", async () => {
  const client = new FakeOssClient();
  const uploader = new OssCdnUploader(client, { bucket: "b", region: "cn-hongkong", partSize: 1024 });

  await uploader.upload(downloaded());

  assert.equal(client.calls[0].options.partSize, 100 * 1024);
});

test("upload rejects when there is no local artifact", async () => {
  const uploader = new OssCdnUploader(new FakeOssClient(), { bucket: "b", region: "cn-hongkong" });
  await assert.rejects(uploader.upload(downloaded({ filePath: undefined })), /without a local artifact/);
});

test("upload propagates OSS client failures", async () => {
  const uploader = new OssCdnUploader(new FakeOssClient({ fail: true }), { bucket: "b", region: "cn-hongkong" });
  await assert.rejects(uploader.upload(downloaded()), /oss upload failed/);
});

test("upload runs the optional CDN refresh step after a successful upload", async () => {
  const refresher = new RecordingRefresher();
  const uploader = new OssCdnUploader(new FakeOssClient(), {
    bucket: "bilisync",
    region: "cn-hongkong",
    cdnBaseUrl: "https://cdn.bilisync.top",
    refresher
  });

  await uploader.upload(downloaded());

  assert.deepEqual(refresher.refreshed, ["https://cdn.bilisync.top/videos/BV1xx411c7mD/original.mp4"]);
});

class FakeOssClient implements OssClient {
  readonly calls: Array<{ objectKey: string; filePath: string; options: OssMultipartOptions }> = [];
  lastParts = 0;

  constructor(private readonly opts: { fail?: boolean; fileSizeByPath?: Record<string, number> } = {}) {}

  async putObjectMultipart(objectKey: string, filePath: string, options: OssMultipartOptions): Promise<OssPutResult> {
    this.calls.push({ objectKey, filePath, options });
    if (this.opts.fail) {
      throw new Error("oss upload failed");
    }
    const size = this.opts.fileSizeByPath?.[filePath] ?? options.partSize;
    this.lastParts = Math.ceil(size / options.partSize);
    return { name: objectKey };
  }
}

class RecordingRefresher implements CdnRefresher {
  readonly refreshed: string[] = [];
  async refresh(url: string): Promise<void> {
    this.refreshed.push(url);
  }
}
