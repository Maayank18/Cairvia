import { randomUUID } from "node:crypto";
import {
  SCHEMA_VERSIONS,
  SyncEventV1Schema,
  type SyncEventV1,
  type SyncEventType,
  type SyncSource
} from "@cairvia/schemas";

type Listener = (event: SyncEventV1) => void;

export class SyncHub {
  private listeners = new Set<Listener>();
  private seen = new Set<string>();
  readonly events: SyncEventV1[] = [];

  publish(partial: Omit<SyncEventV1, "schemaVersion" | "eventId" | "timestamp"> & {
    eventId?: string;
    timestamp?: string;
  }): SyncEventV1 | null {
    const event = SyncEventV1Schema.parse({
      schemaVersion: SCHEMA_VERSIONS.syncEvent,
      eventId: partial.eventId ?? `sync_${randomUUID()}`,
      timestamp: partial.timestamp ?? new Date().toISOString(),
      ...partial
    });
    if (this.seen.has(event.eventId)) {
      return null;
    }
    this.seen.add(event.eventId);
    this.events.push(event);
    if (this.events.length > 200) {
      this.events.shift();
    }
    for (const listener of this.listeners) {
      listener(event);
    }
    return event;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export function syncTypeFromAudit(type: string): SyncEventType {
  if (type === "thread.created") {
    return "THREAD_CREATED";
  }
  if (type === "thread.interrupted" || type === "thread.paused") {
    return "THREAD_INTERRUPTED";
  }
  if (type === "recovery.captured") {
    return "RECOVERY_CAPTURED";
  }
  if (type === "thread.resumed") {
    return "THREAD_RECOVERED";
  }
  if (type === "action_executed" || type === "action.executed") {
    return "ACTION_SUCCEEDED";
  }
  if (type === "action_failed" || type === "action.failed") {
    return "ACTION_FAILED";
  }
  if (type === "user_confirmed" || type === "commitment.extracted") {
    return type === "user_confirmed" ? "COMMITMENT_CONFIRMED" : "AUTOMATION_UPDATED";
  }
  return "THREAD_UPDATED";
}

export function syncSourceFromActor(actor?: string): SyncSource {
  if (actor === "user" || actor === "orb") {
    return "ORB";
  }
  if (actor === "context_interpreter" || actor === "extension") {
    return "EXTENSION";
  }
  if (actor === "commitment_workflow") {
    return "AUTOMATION";
  }
  if (actor === "recovery_agent") {
    return "AGENT";
  }
  return "BACKEND";
}
