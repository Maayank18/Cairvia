# Testing

```bash
pnpm test
pnpm typecheck
pnpm healthcheck
```

Coverage includes domain transitions, IPC allowlist, SQLite restart, commitment idempotency, Cedar, golden continuity scenarios, and three-surface sync (Orb kernel ↔ HTTP ↔ extension capture, stale version, eventId dedupe).

Live Electron + Chrome E2E is manual: see `CAIRVIA_DEMO_FLOW.md`.
