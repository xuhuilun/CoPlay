import type { FastifyInstance } from "fastify";
import { parseRouteId } from "../../shared/rest-params.js";
import type { VideoStore } from "./video.store.js";

export async function registerVideoRoutes(app: FastifyInstance, videos: VideoStore) {
  app.get("/api/videos/hot", async () => ({ items: await videos.hot() }));

  app.get<{ Querystring: { query?: string } }>("/api/videos", async (request) => ({
    items: await videos.list(request.query.query)
  }));

  app.get<{ Params: { id: string } }>("/api/videos/:id", async (request, reply) => {
    const id = parseRouteId(request.params.id, reply);
    if (!id) {
      return;
    }
    const video = await videos.findById(id);
    if (!video) {
      return reply.notFound("Video not found");
    }
    return video;
  });
}
