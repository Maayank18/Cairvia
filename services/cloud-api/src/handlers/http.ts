import type { APIGatewayProxyEventV2, Context } from "aws-lambda";
import { handle } from "hono/aws-lambda";
import { createApi } from "@cairvia/api";
import { kernelForUser, userIdFromEvent } from "../lib/kernel.js";
import { observe } from "../lib/observe.js";

export async function handler(
  event: APIGatewayProxyEventV2,
  context: Context
) {
  const userId = userIdFromEvent(event as never);
  observe({
    requestId: context.awsRequestId,
    result: `${event.requestContext.http.method} ${event.rawPath}`
  });
  const app = createApi(kernelForUser(userId));
  return handle(app)(event as never, context);
}
