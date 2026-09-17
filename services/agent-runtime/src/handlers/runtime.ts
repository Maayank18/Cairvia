import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { ContinuityService, ThreadService } from "@cairvia/domain";
import { DynamoThreadStore } from "@cairvia/cloud-data";
import { invokeDeterministicAgent } from "../tools.js";

function kernel(userId: string) {
  const tableName = process.env.TABLE_NAME;
  if (!tableName) {
    throw new Error("TABLE_NAME is not set");
  }
  const store = new DynamoThreadStore(
    DynamoDBDocumentClient.from(new DynamoDBClient({})),
    tableName,
    userId
  );
  return {
    store,
    threads: new ThreadService(store),
    continuity: new ContinuityService(store),
    userId
  };
}

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  const path = event.rawPath ?? event.requestContext.http.path;
  if (event.requestContext.http.method === "GET" && path.endsWith("/ping")) {
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }
  const started = Date.now();
  const body = event.body ? JSON.parse(event.body) as { prompt?: string; userId?: string } : {};
  const claims = (
    event.requestContext as {
      authorizer?: { jwt?: { claims?: Record<string, string> } };
    }
  ).authorizer?.jwt?.claims;
  const userId =
    claims?.sub ??
    body.userId ??
    process.env.DEMO_USER_ID ??
    "demo";
  const app = kernel(userId);
  let result: unknown;
  let modelError: string | undefined;
  if (process.env.CAIRVIA_DETERMINISTIC_AGENT === "1") {
    result = await invokeDeterministicAgent(app, body.prompt ?? "What should I do first?");
  } else {
    try {
      const { createStrandsAgent } = await import("../create-agent.js");
      const agent = createStrandsAgent(app);
      result = await agent.invoke(body.prompt ?? "What should I do first?");
    } catch (error) {
      modelError = error instanceof Error ? error.message : "model_error";
      result = await invokeDeterministicAgent(app, body.prompt ?? "What should I do first?");
    }
  }
  console.log(
    JSON.stringify({
      requestId: context.awsRequestId,
      agentInvocationId: context.awsRequestId,
      modelLatencyMs: Date.now() - started,
      modelError,
      result: "agent_complete"
    })
  );
  return { statusCode: 200, body: JSON.stringify({ result }) };
};
