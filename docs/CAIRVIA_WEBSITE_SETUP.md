# Cairvia Control Center

```bash
npm run dev
```

Open http://127.0.0.1:5173 — this is started together with the API and Orb.

Screens: NOW, THREADS, AUTOMATIONS, CONTROL.

THREADS can update `currentState` and `nextAction` with `expectedVersion`. SSE invalidates queries so Orb changes appear without refresh.

Production: `pnpm --filter @cairvia/control-center build` → `apps/control-center/dist`. Deploy that static site only behind the same origin policy you set in `CAIRVIA_WEB_ORIGIN`.
