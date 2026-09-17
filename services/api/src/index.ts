import { serve } from "@hono/node-server";
import { LOCAL_API_HOST, LOCAL_API_PORT } from "@cairvia/config";
import { createAppKernel } from "@cairvia/local-store";
import { createApi, type AppKernel } from "./app.js";

export async function startLocalApi(
  kernel?: AppKernel,
  port: number = LOCAL_API_PORT
) {
  const resolved = kernel ?? (await createAppKernel());
  const app = createApi(resolved);
  const server = serve({
    fetch: app.fetch,
    hostname: LOCAL_API_HOST,
    port
  });
  return { server, kernel: resolved, app };
}

export { createApi };
export type { AppKernel } from "./app.js";
