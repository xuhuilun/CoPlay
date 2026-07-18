import type { FastifyInstance } from "fastify";
import type { VideoRepository } from "./video.repository.js";

export async function registerVideoRoutes(app: FastifyInstance, videos: VideoRepository) {
  app.get("/api/videos/hot", async () => ({ items: videos.hot() }));

  app.get<{ Querystring: { query?: string } }>("/api/videos", async (request) => ({
    items: videos.list(request.query.query)
  }));

  app.get<{ Params: { id: string } }>("/api/videos/:id", async (request, reply) => {
    const video = videos.findById(request.params.id);
    if (!video) {
      return reply.notFound("Video not found");
    }
    return video;
  });
}
