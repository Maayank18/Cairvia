import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand
} from "@aws-sdk/lib-dynamodb";
import {
  ActionPermissionV1Schema,
  CommitmentCandidateV1Schema,
  ContextItemV1Schema,
  ContextSnapshotV1Schema,
  ExecutionEventV1Schema,
  RecoveryCapsuleV1Schema,
  SCHEMA_VERSIONS,
  SyncQueueItemV1Schema,
  UserPreferencesV1Schema,
  WorkThreadV1Schema,
  defaultUserPreferences,
  type ActionPermissionV1,
  type CommitmentCandidateV1,
  type ContextItemV1,
  type ContextSnapshotV1,
  type ExecutionEventV1,
  type RecoveryCapsuleV1,
  type SyncQueueItemV1,
  type UserPreferencesV1,
  type WorkThreadV1
} from "@cairvia/schemas";
import { defaultPermissions, type ThreadStore } from "@cairvia/domain";
import {
  auditSk,
  commitmentSk,
  contextSk,
  idempotencySk,
  OPEN_STATUSES,
  openIndexPk,
  pendingCmtPk,
  snapSk,
  threadSk,
  updatedSk,
  userPk
} from "./keys.js";

type Item = Record<string, unknown>;

export class ConditionalWriteError extends Error {
  constructor() {
    super("Conditional write failed — thread was updated elsewhere");
    this.name = "ConditionalWriteError";
  }
}

export class DynamoThreadStore implements ThreadStore {
  constructor(
    private readonly doc: DynamoDBDocumentClient,
    private readonly tableName: string,
    private readonly userId: string
  ) {}

  private pk(): string {
    return userPk(this.userId);
  }

  async insertThread(thread: WorkThreadV1): Promise<void> {
    const parsed = WorkThreadV1Schema.parse(thread);
    await this.putThread(parsed, true);
  }

  async getThread(id: string): Promise<WorkThreadV1 | null> {
    const result = await this.doc.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: this.pk(), SK: threadSk(id) }
      })
    );
    if (!result.Item?.payload) {
      return null;
    }
    return WorkThreadV1Schema.parse(JSON.parse(String(result.Item.payload)));
  }

  async getActiveThread(): Promise<WorkThreadV1 | null> {
    const open = await this.queryOpen();
    return open[0] ?? null;
  }

  async listThreads(): Promise<WorkThreadV1[]> {
    const result = await this.doc.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: {
          ":pk": this.pk(),
          ":sk": "THREAD#"
        }
      })
    );
    return (result.Items ?? []).map((item) =>
      WorkThreadV1Schema.parse(JSON.parse(String(item.payload)))
    );
  }

  async updateThread(thread: WorkThreadV1): Promise<void> {
    const parsed = WorkThreadV1Schema.parse(thread);
    const current = await this.getRawThread(parsed.id);
    const version = Number(current?.version ?? 0);
    try {
      await this.doc.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { PK: this.pk(), SK: threadSk(parsed.id) },
          UpdateExpression:
            "SET payload = :p, #status = :s, updatedAt = :u, version = :nv, GSI1PK = :g1p, GSI1SK = :g1s",
          ConditionExpression: "attribute_not_exists(version) OR version = :ov",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":p": JSON.stringify(parsed),
            ":s": parsed.status,
            ":u": parsed.updatedAt,
            ":ov": version,
            ":nv": version + 1,
            ":g1p": OPEN_STATUSES.has(parsed.status)
              ? openIndexPk(this.userId)
              : `USER#${this.userId}#CLOSED`,
            ":g1s": updatedSk(parsed.updatedAt)
          }
        })
      );
    } catch (error) {
      if ((error as { name?: string }).name === "ConditionalCheckFailedException") {
        throw new ConditionalWriteError();
      }
      throw error;
    }
  }

  async insertCapsule(capsule: RecoveryCapsuleV1): Promise<void> {
    const parsed = RecoveryCapsuleV1Schema.parse(capsule);
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: this.pk(),
          SK: `CAP#${parsed.threadId}#${parsed.capturedAt}#${parsed.id}`,
          entityType: "CAPSULE",
          payload: JSON.stringify(parsed)
        }
      })
    );
  }

  async getLatestCapsule(threadId: string): Promise<RecoveryCapsuleV1 | null> {
    const result = await this.doc.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: {
          ":pk": this.pk(),
          ":sk": `CAP#${threadId}#`
        },
        ScanIndexForward: false,
        Limit: 1
      })
    );
    const item = result.Items?.[0];
    return item?.payload
      ? RecoveryCapsuleV1Schema.parse(JSON.parse(String(item.payload)))
      : null;
  }

  async appendEvent(event: ExecutionEventV1): Promise<void> {
    const parsed = ExecutionEventV1Schema.parse(event);
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: this.pk(),
          SK: auditSk(parsed.createdAt, parsed.id),
          entityType: "AUDIT",
          payload: JSON.stringify(parsed)
        }
      })
    );
  }

  async listEvents(limit = 100): Promise<ExecutionEventV1[]> {
    const result = await this.doc.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: { ":pk": this.pk(), ":sk": "AUDIT#" },
        ScanIndexForward: false,
        Limit: limit
      })
    );
    return (result.Items ?? []).map((item) =>
      ExecutionEventV1Schema.parse(JSON.parse(String(item.payload)))
    );
  }

  async enqueueSync(item: SyncQueueItemV1): Promise<void> {
    const parsed = SyncQueueItemV1Schema.parse(item);
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: this.pk(),
          SK: `SYNC#${parsed.id}`,
          entityType: "SYNC",
          payload: JSON.stringify(parsed)
        }
      })
    );
  }

  async listPendingSync(): Promise<SyncQueueItemV1[]> {
    return [];
  }

  async markSync(id: string, status: SyncQueueItemV1["status"]): Promise<void> {
    void id;
    void status;
  }

  async getPreferences(): Promise<UserPreferencesV1> {
    const result = await this.doc.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: this.pk(), SK: "PREFS" }
      })
    );
    if (!result.Item?.payload) {
      return defaultUserPreferences();
    }
    return UserPreferencesV1Schema.parse(JSON.parse(String(result.Item.payload)));
  }

  async savePreferences(prefs: UserPreferencesV1): Promise<void> {
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: this.pk(),
          SK: "PREFS",
          entityType: "PREFS",
          payload: JSON.stringify(UserPreferencesV1Schema.parse(prefs))
        }
      })
    );
  }

  async listPermissions(): Promise<ActionPermissionV1[]> {
    return defaultPermissions(new Date().toISOString());
  }

  async savePermissions(permissions: ActionPermissionV1[]): Promise<void> {
    void ActionPermissionV1Schema;
    void permissions;
  }

  async insertSnapshot(snapshot: ContextSnapshotV1): Promise<void> {
    const parsed = ContextSnapshotV1Schema.parse(snapshot);
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: this.pk(),
          SK: snapSk(parsed.threadId, parsed.capturedAt, parsed.id),
          entityType: "SNAP",
          payload: JSON.stringify(parsed)
        }
      })
    );
  }

  async listSnapshots(threadId?: string): Promise<ContextSnapshotV1[]> {
    const prefix = threadId ? `SNAP#${threadId}#` : "SNAP#";
    const result = await this.doc.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: { ":pk": this.pk(), ":sk": prefix },
        ScanIndexForward: false
      })
    );
    return (result.Items ?? []).map((item) =>
      ContextSnapshotV1Schema.parse(JSON.parse(String(item.payload)))
    );
  }

  async insertContextItem(item: ContextItemV1): Promise<void> {
    const parsed = ContextItemV1Schema.parse(item);
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: this.pk(),
          SK: contextSk(parsed.id),
          entityType: "CTX",
          payload: JSON.stringify(parsed)
        }
      })
    );
  }

  async listContextItems(): Promise<ContextItemV1[]> {
    const result = await this.doc.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: { ":pk": this.pk(), ":sk": "CTX#" }
      })
    );
    return (result.Items ?? []).map((item) =>
      ContextItemV1Schema.parse(JSON.parse(String(item.payload)))
    );
  }

  async saveCommitment(item: CommitmentCandidateV1): Promise<void> {
    const parsed = CommitmentCandidateV1Schema.parse(item);
    const pending = parsed.status === "WAITING_FOR_USER";
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: this.pk(),
          SK: commitmentSk(parsed.id),
          entityType: "CMT",
          payload: JSON.stringify(parsed),
          GSI2PK: pending ? pendingCmtPk(this.userId) : `USER#${this.userId}#CMT#DONE`,
          GSI2SK: updatedSk(parsed.updatedAt)
        }
      })
    );
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: this.pk(),
          SK: idempotencySk(parsed.idempotencyKey),
          entityType: "IDEMP",
          commitmentId: parsed.id
        }
      })
    );
  }

  async getCommitment(id: string): Promise<CommitmentCandidateV1 | null> {
    const result = await this.doc.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: this.pk(), SK: commitmentSk(id) }
      })
    );
    return result.Item?.payload
      ? CommitmentCandidateV1Schema.parse(JSON.parse(String(result.Item.payload)))
      : null;
  }

  async getCommitmentByIdempotency(
    key: string
  ): Promise<CommitmentCandidateV1 | null> {
    const pointer = await this.doc.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: this.pk(), SK: idempotencySk(key) }
      })
    );
    const id = pointer.Item?.commitmentId;
    if (typeof id !== "string") {
      return null;
    }
    return this.getCommitment(id);
  }

  async listCommitments(): Promise<CommitmentCandidateV1[]> {
    const result = await this.doc.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: { ":pk": this.pk(), ":sk": "CMT#" },
        ScanIndexForward: false
      })
    );
    return (result.Items ?? []).map((item) =>
      CommitmentCandidateV1Schema.parse(JSON.parse(String(item.payload)))
    );
  }

  private async getRawThread(id: string): Promise<Item | undefined> {
    const result = await this.doc.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: this.pk(), SK: threadSk(id) }
      })
    );
    return result.Item as Item | undefined;
  }

  private async putThread(thread: WorkThreadV1, create: boolean): Promise<void> {
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: this.pk(),
          SK: threadSk(thread.id),
          entityType: "THREAD",
          payload: JSON.stringify(thread),
          status: thread.status,
          version: 1,
          updatedAt: thread.updatedAt,
          GSI1PK: OPEN_STATUSES.has(thread.status)
            ? openIndexPk(this.userId)
            : `USER#${this.userId}#CLOSED`,
          GSI1SK: updatedSk(thread.updatedAt)
        },
        ConditionExpression: create ? "attribute_not_exists(PK)" : undefined
      })
    );
  }

  private async queryOpen(): Promise<WorkThreadV1[]> {
    const result = await this.doc.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk",
        ExpressionAttributeValues: { ":pk": openIndexPk(this.userId) },
        ScanIndexForward: false
      })
    );
    return (result.Items ?? []).map((item) =>
      WorkThreadV1Schema.parse(JSON.parse(String(item.payload)))
    );
  }
}
