export function SyncStatus({
  state,
  lastSyncAt
}: {
  state: "CONNECTED" | "CONNECTING" | "OFFLINE" | "RECONNECTING" | "SYNCING" | "SYNC_ERROR";
  lastSyncAt?: string | null;
}) {
  const label =
    state === "CONNECTED"
      ? lastSyncAt
        ? "Synced"
        : "Connected"
      : state === "SYNCING"
        ? "Syncing"
        : state === "RECONNECTING"
          ? "Reconnecting"
          : state === "SYNC_ERROR"
            ? "Sync error"
            : state === "CONNECTING"
              ? "Connecting"
              : "Offline";
  const color =
    state === "CONNECTED"
      ? "var(--ready)"
      : state === "SYNCING" || state === "CONNECTING" || state === "RECONNECTING"
        ? "var(--wait)"
        : "var(--offline)";
  return (
    <p role="status" aria-live="polite" style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
      <span
        aria-hidden="true"
        style={{
          display: "inline-block",
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: color,
          marginRight: 8
        }}
      />
      {label}
      {lastSyncAt ? ` · ${new Date(lastSyncAt).toLocaleTimeString()}` : ""}
    </p>
  );
}
