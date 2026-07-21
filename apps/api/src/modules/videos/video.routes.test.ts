import sensible from "@fastify/sensible";
import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { VideoRepository } from "./video.repository.js";
import { registerVideoRoutes } from "./video.routes.js";

test("GET /api/videos/hot returns sorted hot videos", async () => {
  const { app } = await createVideoRoutesTestApp();

  const response = await app.inject({
    method: "GET",
    url: "/api/videos/hot"
  });

  assert.equal(response.statusCode, 200);
  const items = response.json().items;
  assert.equal(items.length, 3);
  assert.equal(items[0].title, "星港夜航");
  assert.ok(items[0].hotScore >= items[1].hotScore);

  await app.close();
});

test("GET /api/videos searches title, description, and tags", async () => {
  const { app } = await createVideoRoutesTestApp();

  const byTitle = await app.inject({
    method: "GET",
    url: "/api/videos?query=%E8%8A%B1%E5%9B%AD"
  });
  assert.equal(byTitle.statusCode, 200);
  assert.deepEqual(
    byTitle.json().items.map((video: { title: string }) => video.title),
    ["花园短片"]
  );

  const byTag = await app.inject({
    method: "GET",
    url: "/api/videos?query=ocean"
  });
  assert.equal(byTag.statusCode, 200);
  assert.deepEqual(
    byTag.json().items.map((video: { title: string }) => video.title),
    ["海岸慢镜"]
  );

  const normalized = await app.inject({
    method: "GET",
    url: "/api/videos?query=%20OCEAN%20"
  });
  assert.equal(normalized.statusCode, 200);
  assert.deepEqual(
    normalized.json().items.map((video: { title: string }) => video.title),
    ["海岸慢镜"]
  );

  await app.close();
});

test("GET /api/videos/:id returns video detail", async () => {
  const { app, videos } = await createVideoRoutesTestApp();
  const [video] = videos.hot();
  assert.ok(video);

  const response = await app.inject({
    method: "GET",
    url: `/api/videos/${video.id}`
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().id, video.id);
  assert.equal(response.json().title, video.title);

  await app.close();
});

test("GET /api/videos/:id normalizes route ids", async () => {
  const { app, videos } = await createVideoRoutesTestApp();
  const [video] = videos.hot();
  assert.ok(video);

  const padded = await app.inject({
    method: "GET",
    url: `/api/videos/${encodeURIComponent(` ${video.id} `)}`
  });
  assert.equal(padded.statusCode, 200);
  assert.equal(padded.json().id, video.id);

  const blank = await app.inject({
    method: "GET",
    url: "/api/videos/%20"
  });
  assert.equal(blank.statusCode, 400);

  await app.close();
});

test("GET /api/videos/:id returns 404 for missing videos", async () => {
  const { app } = await createVideoRoutesTestApp();

  const response = await app.inject({
    method: "GET",
    url: "/api/videos/missing_video"
  });

  assert.equal(response.statusCode, 404);

  await app.close();
});

async function createVideoRoutesTestApp() {
  const app = Fastify();
  const videos = new VideoRepository();
  await app.register(sensible);
  await registerVideoRoutes(app, videos);
  return { app, videos };
}
