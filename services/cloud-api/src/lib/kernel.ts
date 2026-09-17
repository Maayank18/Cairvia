import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand
} from "@aws-sdk/lib-dynamodb";
import { SFNClient, SendTaskSuccessCommand } from "@aws-sdk/client-sfn";
import { ContinuityService, ThreadService } from "@cairvia/domain";
import { DynamoThreadStore } from "@cairvia/cloud-data";
import type { AppKernel } from "@cairvia/api";

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true }
});
const events = new EventBridgeClient({});
const sfn = new SFNClient({});

export function kernelForUser(userId: string): AppKernel {
  const tableName = process.env.TABLE_NAME;
  if (!tableName) {
    throw new Error("TABLE_NAME is not set");
  }
  const store = new DynamoThreadStore(doc, tableName, userId);
  return {
    store,
    threads: new ThreadService(store),
    continuity: new ContinuityService(store),
    userId,
    emitContextCaptured: async (detail) => {
      const bus = process.env.EVENT_BUS_NAME;
      if (!bus) {
        return;
      }
      await events.send(
        new PutEventsCommand({
          Entries: [
            {
              EventBusName: bus,
              Source: "cairvia.browser",
              DetailType: "ContextCaptured",
              Detail: JSON.stringify(detail)
            }
          ]
        })
      );
    },
    onCommitmentDecided: async (commitmentId, decision) => {
      const tokenItem = await doc.send(
        new GetCommand({
          TableName: tableName,
          Key: { PK: `USER#${userId}`, SK: `SFNTOKEN#${commitmentId}` }
        })
      );
      const token = tokenItem.Item?.token as string | undefined;
      if (!token) {
        return;
      }
      await sfn.send(
        new SendTaskSuccessCommand({
          taskToken: token,
          output: JSON.stringify({
            userId,
            commitmentId,
            approved: decision === "add"
          })
        })
      );
    }
  };
}

export function userIdFromEvent(event: {
  requestContext?: { authorizer?: { jwt?: { claims?: Record<string, string> } } };
}): string {
  return (
    event.requestContext?.authorizer?.jwt?.claims?.sub ??
    process.env.DEMO_USER_ID ??
    "demo"
  );
}

export async function saveTaskToken(
  userId: string,
  commitmentId: string,
  token: string
): Promise<void> {
  const tableName = process.env.TABLE_NAME;
  if (!tableName) {
    throw new Error("TABLE_NAME is not set");
  }
  await doc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: `USER#${userId}`,
        SK: `SFNTOKEN#${commitmentId}`,
        entityType: "SFNTOKEN",
        token,
        commitmentId,
        updatedAt: new Date().toISOString()
      }
    })
  );
}
