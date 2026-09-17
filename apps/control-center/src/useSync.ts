import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LOCAL_API_ORIGIN } from "@cairvia/config/constants";
import { SyncEventV1Schema, type SyncEventV1 } from "@cairvia/schemas";

export type ConnectionState =
  | "CONNECTED"
  | "CONNECTING"
  | "OFFLINE"
  | "RECONNECTING"
  | "SYNCING"
  | "SYNC_ERROR";

export function useCairviaSync() {
  const client = useQueryClient();
  const [state, setState] = useState<ConnectionState>(
    navigator.onLine ? "CONNECTING" : "OFFLINE"
  );
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<SyncEventV1 | null>(null);

  useEffect(() => {
    if (!navigator.onLine) {
      setState("OFFLINE");
      return;
    }
    let source: EventSource | null = null;
    let closed = false;
    const seen = new Set<string>();

    function connect() {
      if (closed) {
        return;
      }
      setState((current) =>
        current === "CONNECTED" ? "CONNECTED" : "CONNECTING"
      );
      source = new EventSource(`${LOCAL_API_ORIGIN}/v1/sync/stream`);
      source.onopen = () => setState("CONNECTED");
      source.onerror = () => {
        setState(navigator.onLine ? "RECONNECTING" : "OFFLINE");
        source?.close();
        window.setTimeout(connect, 1500);
      };
      source.onmessage = (message) => {
        apply(message.data);
      };
      for (const type of [
        "THREAD_CREATED",
        "THREAD_UPDATED",
        "THREAD_INTERRUPTED",
        "RECOVERY_CAPTURED",
        "THREAD_RECOVERED",
        "ACTION_SUCCEEDED",
        "ACTION_FAILED",
        "COMMITMENT_CONFIRMED",
        "AUTOMATION_UPDATED"
      ]) {
        source.addEventListener(type, (message) => {
          apply((message as MessageEvent).data);
        });
      }
    }

    function apply(raw: string) {
      try {
        const event = SyncEventV1Schema.parse(JSON.parse(raw));
        if (seen.has(event.eventId)) {
          return;
        }
        seen.add(event.eventId);
        setState("SYNCING");
        setLastEvent(event);
        setLastSyncAt(event.timestamp);
        void client.invalidateQueries();
        window.setTimeout(() => setState("CONNECTED"), 250);
      } catch {
        setState("SYNC_ERROR");
      }
    }

    connect();
    return () => {
      closed = true;
      source?.close();
    };
  }, [client]);

  return { state, lastSyncAt, lastEvent };
}
