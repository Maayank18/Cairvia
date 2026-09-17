export type EntityType =
  | "THREAD"
  | "SNAP"
  | "CMT"
  | "AUDIT"
  | "CTX"
  | "PREFS"
  | "IDEMP";

export function userPk(userId: string): string {
  return `USER#${userId}`;
}

export function threadSk(threadId: string): string {
  return `THREAD#${threadId}`;
}

export function snapSk(threadId: string, capturedAt: string, id: string): string {
  return `SNAP#${threadId}#${capturedAt}#${id}`;
}

export function commitmentSk(id: string): string {
  return `CMT#${id}`;
}

export function idempotencySk(key: string): string {
  return `IDEMP#${key}`;
}

export function auditSk(createdAt: string, id: string): string {
  return `AUDIT#${createdAt}#${id}`;
}

export function contextSk(id: string): string {
  return `CTX#${id}`;
}

export function openIndexPk(userId: string): string {
  return `USER#${userId}#OPEN`;
}

export function pendingCmtPk(userId: string): string {
  return `USER#${userId}#CMT#PENDING`;
}

export function updatedSk(iso: string): string {
  return `UPDATED#${iso}`;
}

export const OPEN_STATUSES = new Set([
  "DRAFT",
  "ACTIVE",
  "PAUSED",
  "BLOCKED",
  "INTERRUPTED",
  "RECOVERABLE"
]);
