# Three-surface sync

Primary mechanism: **Server-Sent Events** on `GET /v1/sync/stream`.

Not used: page reload, `setInterval` polling, Socket.IO.

## Contract

`SyncEventV1`: `eventId`, `type`, `userId`, `threadId?`, `source`, `version`, `timestamp`, `payload`.

Sources: `ORB` | `EXTENSION` | `WEB` | `BACKEND` | `AUTOMATION` | `AGENT`.

## Flow

1. Orb IPC or Control Center HTTP or Extension POST mutates `ThreadService` / commitment workflow.
2. `SyncHub.publish` (duplicate `eventId` ignored).
3. SSE clients (Control Center `EventSource`, Orb renderer, extension service worker) apply the event.
4. Control Center invalidates React Query. Orb reloads the active thread via IPC. Extension stores `lastSyncAt`.

## Conflict

Two surfaces must send `expectedVersion`. If the stored version differs, the write is rejected. The client should reload the thread and retry.

## Reconnect

EventSource reconnects. Clients must ignore duplicate `eventId`s.

## Connection UI

States: CONNECTED, CONNECTING, OFFLINE, RECONNECTING, SYNCING, SYNC_ERROR.

The UI may say **Synced** only after a confirmed stream connection or a received event — not on paint.
