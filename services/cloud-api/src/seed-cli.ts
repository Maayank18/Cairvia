import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DynamoThreadStore } from "@cairvia/cloud-data";
import { seedIfEmpty } from "@cairvia/local-store";

const tableName = process.env.TABLE_NAME;
const userId = process.env.DEMO_USER_ID ?? "demo";
if (!tableName) {
  throw new Error("TABLE_NAME is required");
}

const store = new DynamoThreadStore(
  DynamoDBDocumentClient.from(new DynamoDBClient({})),
  tableName,
  userId
);
const thread = await seedIfEmpty(store);
console.log(`Seeded Work Thread ${thread.id} for ${userId} in ${tableName}`);
