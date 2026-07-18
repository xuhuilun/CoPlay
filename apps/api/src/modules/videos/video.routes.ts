import type { FastifyInstance } from "fastify";
import type { VideoStore } from "./video.store.js";

export async function registerVideoRoutes(app: FastifyInstance, videos: VideoStore) {
  app.get("/api/videos/hot", async () => ({ items: await videos.hot() }));

  app.get<{ Querystring: { query?: string } }>("/api/videos", async (request) => ({
    items: await videos.list(request.query.query)
  }));

  app.get<{ Params: { id: string } }>("/api/videos/:id", async (request, reply) => {
    const video = await videos.findById(request.params.id);
    if (!video) {
      return reply.notFound("Video not found");
    }
    return video;
  });
}
