# Cairvia architecture

Cairvia is one product with three surfaces:

```text
Orb (Electron)     Extension (MV3)     Control Center (web)
        \                |                   /
         \               |                  /
              Local Hono API :47821
                         |
              SQLite Work Thread (local)
                         |
              Optional AWS (Cognito, API Gateway, Lambda, DynamoDB,
              EventBridge, Step Functions, Bedrock/Strands)
```

## Source of truth

| Data | Owner |
| --- | --- |
| Work Thread lifecycle, recovery capsules, commitments, audit | Backend store (SQLite locally, DynamoDB when deployed) |
| Orb panel open/closed, selected Control Center tab | Ephemeral UI |
| Agent memory | Not canonical. DynamoDB/SQLite owns Work Thread state. |

Clients project the canonical Work Thread. They must not keep a competing thread object that can overwrite newer server state.

## Domain events

Mutations go through `ThreadService` (and a few HTTP helpers). `SyncHub` then emits `SyncEventV1` over SSE `GET /v1/sync/stream`.

Conflict: `expectedVersion` on thread updates. Mismatch → `StaleWriteError` / HTTP 409.

Idempotency: commitment `idempotencyKey`; sync `eventId` dedupe in `SyncHub`.
