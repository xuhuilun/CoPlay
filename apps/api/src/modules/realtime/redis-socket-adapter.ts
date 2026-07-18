import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import type { Server } from "socket.io";

export async function registerRedisSocketAdapter(io: Server, redisUrl: string) {
  const pubClient = createClient({ url: redisUrl });
  const subClient = pubClient.duplicate();

  await Promise.all([pubClient.connect(), subClient.connect()]);
  io.adapter(createAdapter(pubClient, subClient));

  return async () => {
    await Promise.allSettled([pubClient.quit(), subClient.quit()]);
  };
}
