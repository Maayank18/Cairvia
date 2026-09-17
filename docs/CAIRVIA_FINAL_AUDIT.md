# Cairvia final audit

## Executive summary

Cairvia is one Work Thread with three surfaces. Live updates use **SSE** (`GET /v1/sync/stream`) from the shared Hono kernel, not page reload or fake timers. Thread writes use `version` / `expectedVersion`. Automated tests: **71 passed**. AWS deploy and a full Electron+Chrome sitting were not executed in this pass.

## Architecture reviewed

Orb IPC and Control Center/Extension HTTP share `createAppKernel()` → SQLite `ThreadService` + `SyncHub`. Optional AWS stack remains in `infrastructure/cdk`.

## Three-surface status

| Surface | Build | Runtime | Auth | Sync | Security | E2E |
| --- | --- | --- | --- | --- | --- | --- |
| Orb | PASS (electron-vite present) | PASS (dev path) | Local kernel only | PASS (SSE + IPC same kernel) | PASS (isolation, IPC allowlist) | PARTIAL (automated kernel/API; live window not packaged here) |
| Extension | PASS (unpacked JS) | PASS (service worker + popup) | Local API | PASS (POST + EventSource) | PASS (selection-only, provenance) | PARTIAL (API capture tested; Chrome UI not driven) |
| Website | PASS (`vite build` available) | PASS (dev server) | Local API | PASS (EventSource + query invalidate) | PASS (CORS, no secrets) | PARTIAL (HTTP tests; live SSE in browser not re-run this pass) |

Local identity is the single-user SQLite kernel. Cognito JWT applies only after `cdk deploy`.

## Synchronization tests

Automated: Orb kernel write visible over HTTP; HTTP write visible to kernel; extension capture attached to the same thread; `eventId` dedupe; stale `expectedVersion` rejected. See `tests/evaluation/three-surface-sync.test.ts`.

## Conflict tests

`StaleWriteError` when `expectedVersion` does not match. HTTP 409.

## Offline tests

Orb keeps last thread on failed IPC. Status copy: last saved context available. Restart SQLite tested.

## AWS validation

CDK stack present (Cognito, HTTP API, Lambda, DynamoDB, S3, EventBridge, Step Functions, agent Lambda). **Not deployed in this audit.** AgentCore Gateway/Memory not implemented (documented, not faked).

## Security findings

- No AWS keys in Git.
- Extension popup uses `innerHTML` for user-selected candidate text from the local API — acceptable for this trust boundary; do not feed remote HTML.
- `spawn` only in main-process allowlisted executors.

## Performance findings

SSE instead of polling. Context packet is bounded (recent events, 6 evidence refs). Agent tools do not dump the store.

## AI/agent findings

`ProposedActionV1` Zod, `invented: false`. Deterministic fallback when Bedrock is down.

## Documentation status

`docs/` guides listed in README. `.env.example` has no secrets.

## Bugs fixed

- Cross-surface live sync (SSE + shared hub)
- Optimistic concurrency on Work Thread
- Stale IPC “offline” copy while online
- Latest recovery capsule when timestamps collide
- Extension context menu registration after sync hook

## Remaining issues

- No Cognito on the local loop
- Electron installer / Chrome store packaging not configured
- AWS `cdk deploy` not run here
- Control Center is a SPA hash UI, not a hosted production CDN

## Production readiness

Hackathon-local: ready. Cloud production: deploy CDK, set Cognito password out of band, seed DynamoDB, point Control Center CORS/`CAIRVIA_WEB_ORIGIN` at the real origin.
