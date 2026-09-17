import { serve } from "@hono/node-server";
import { LOCAL_API_HOST, LOCAL_API_ORIGIN, LOCAL_API_PORT } from "@cairvia/config";
import { createAppKernel } from "@cairvia/local-store";
import { createApi, decideCommitment, type AppKernel } from "./app.js";

export async function isLocalApiHealthy(
  origin: string = LOCAL_API_ORIGIN
): Promise<boolean> {
  try {
    const response = await fetch(`${origin}/health`, {
      signal: AbortSignal.timeout(800)
    });
    if (!response.ok) {
      return false;
    }
    const body = (await response.json()) as { product?: string };
    return body.product === "cairvia";
  } catch {
    return false;
  }
}

export async function waitForLocalApi(
  timeoutMs = 15_000,
  origin: string = LOCAL_API_ORIGIN
): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await isLocalApiHealthy(origin)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

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

export { createApi, decideCommitment };
export type { AppKernel } from "./app.js";
