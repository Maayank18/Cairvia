import type {
  ActionPermissionV1,
  CommitmentCandidateV1,
  ContextItemV1,
  ContextSnapshotV1,
  ExecutionEventV1,
  RecoveryCapsuleV1,
  SyncQueueItemV1,
  UserPreferencesV1,
  WorkThreadV1
} from "@cairvia/schemas";

export interface ThreadStore {
  insertThread(thread: WorkThreadV1): Promise<void>;
  getThread(id: string): Promise<WorkThreadV1 | null>;
  getActiveThread(): Promise<WorkThreadV1 | null>;
  listThreads(): Promise<WorkThreadV1[]>;
  updateThread(thread: WorkThreadV1): Promise<void>;
  insertCapsule(capsule: RecoveryCapsuleV1): Promise<void>;
  getLatestCapsule(threadId: string): Promise<RecoveryCapsuleV1 | null>;
  appendEvent(event: ExecutionEventV1): Promise<void>;
  listEvents(limit?: number): Promise<ExecutionEventV1[]>;
  enqueueSync(item: SyncQueueItemV1): Promise<void>;
  listPendingSync(): Promise<SyncQueueItemV1[]>;
  markSync(id: string, status: SyncQueueItemV1["status"]): Promise<void>;
  getPreferences(): Promise<UserPreferencesV1>;
  savePreferences(prefs: UserPreferencesV1): Promise<void>;
  listPermissions(): Promise<ActionPermissionV1[]>;
  savePermissions(permissions: ActionPermissionV1[]): Promise<void>;
  insertSnapshot(snapshot: ContextSnapshotV1): Promise<void>;
  listSnapshots(threadId?: string): Promise<ContextSnapshotV1[]>;
  insertContextItem(item: ContextItemV1): Promise<void>;
  listContextItems(threadId?: string): Promise<ContextItemV1[]>;
  saveCommitment(item: CommitmentCandidateV1): Promise<void>;
  getCommitment(id: string): Promise<CommitmentCandidateV1 | null>;
  getCommitmentByIdempotency(key: string): Promise<CommitmentCandidateV1 | null>;
  listCommitments(): Promise<CommitmentCandidateV1[]>;
}
