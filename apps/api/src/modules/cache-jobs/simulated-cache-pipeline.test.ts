import assert from "node:assert/strict";
import test from "node:test";
import { SimulatedBilibiliDownloader, SimulatedCdnUploader } from "./simulated-cache-pipeline.js";

test("simulated downloader derives a stable artifact id from the video reference", async () => {
  const downloader = new SimulatedBilibiliDownloader();

  const first = await downloader.download("https://www.bilibili.com/video/BV1xx411c7mD");
  const again = await downloader.download("https://www.bilibili.com/video/BV1xx411c7mD?p=2");

  assert.equal(first.artifactId, "BV1xx411c7mD");
  assert.equal(again.artifactId, "BV1xx411c7mD");
  assert.equal(first.ref?.kind, "bv");
  assert.ok(first.durationSeconds > 0);
  assert.ok(first.posterUrl.startsWith("https://"));
});

test("simulated downloader falls back to the source url for short links", async () => {
  const downloader = new SimulatedBilibiliDownloader();

  const result = await downloader.download("https://b23.tv/example");

  assert.equal(result.ref?.kind, "short");
  assert.equal(result.artifactId, "example");
});

test("simulated uploader returns a playable rendition and passes the poster through", async () => {
  const downloader = new SimulatedBilibiliDownloader();
  const uploader = new SimulatedCdnUploader();

  const downloaded = await downloader.download("https://www.bilibili.com/video/BV1xx411c7mD");
  const uploaded = await uploader.upload(downloaded);

  assert.equal(uploaded.posterUrl, downloaded.posterUrl);
  assert.ok(uploaded.sources.length >= 1);
  for (const source of uploaded.sources) {
    assert.ok(source.id.length > 0);
    assert.ok(source.label.length > 0);
    assert.ok(source.url.startsWith("https://"));
  }
});
