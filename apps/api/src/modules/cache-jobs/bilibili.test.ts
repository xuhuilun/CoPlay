import assert from "node:assert/strict";
import test from "node:test";
import { describeCachedVideo, isSupportedBilibiliUrl, parseBilibiliRef } from "./bilibili.js";

test("parseBilibiliRef extracts BV ids from bilibili.com links", () => {
  assert.deepEqual(parseBilibiliRef("https://www.bilibili.com/video/BV1xx411c7mD"), {
    kind: "bv",
    id: "BV1xx411c7mD"
  });
  assert.deepEqual(parseBilibiliRef("https://m.bilibili.com/video/BV1xx411c7mD?p=2"), {
    kind: "bv",
    id: "BV1xx411c7mD"
  });
});

test("parseBilibiliRef extracts legacy av ids", () => {
  assert.deepEqual(parseBilibiliRef("https://www.bilibili.com/video/av170001"), {
    kind: "av",
    id: "av170001"
  });
});

test("parseBilibiliRef accepts b23.tv short links by first path segment", () => {
  assert.deepEqual(parseBilibiliRef("https://b23.tv/example"), { kind: "short", id: "example" });
  assert.equal(parseBilibiliRef("https://b23.tv/"), undefined);
});

test("parseBilibiliRef rejects unsupported hosts and video-less bilibili links", () => {
  assert.equal(parseBilibiliRef("https://example.com/video/BV1xx411c7mD"), undefined);
  assert.equal(parseBilibiliRef("https://www.bilibili.com/"), undefined);
  assert.equal(parseBilibiliRef("https://www.bilibili.com/anime/index"), undefined);
  assert.equal(parseBilibiliRef("not-a-url"), undefined);
});

test("isSupportedBilibiliUrl mirrors the parser", () => {
  assert.equal(isSupportedBilibiliUrl("https://www.bilibili.com/video/BV1xx411c7mD"), true);
  assert.equal(isSupportedBilibiliUrl("https://b23.tv/example"), true);
  assert.equal(isSupportedBilibiliUrl("https://www.bilibili.com/"), false);
  assert.equal(isSupportedBilibiliUrl("https://example.com/"), false);
});

test("describeCachedVideo surfaces the video id while keeping titles unique", () => {
  const first = describeCachedVideo("https://www.bilibili.com/video/BV1xx411c7mD", "job_aaaaaa111111");
  const second = describeCachedVideo("https://www.bilibili.com/video/BV1xx411c7mD", "job_bbbbbb222222");
  assert.match(first.title, /BV1xx411c7mD/);
  assert.notEqual(first.title, second.title);
  assert.match(first.description, /BV1xx411c7mD/);

  const short = describeCachedVideo("https://b23.tv/example", "job_cccccc333333");
  assert.match(short.title, /B站缓存视频/);
});
