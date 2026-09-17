# Cairvia

**The continuity layer for human work.**  
**Keep the thread. Continue the work.**

Cairvia is a persistent, user-controlled Work Thread system. It remembers the smallest useful state required to continue after interruption: intent, current state, blocker, last decision, and **one next action**.

It is not a chatbot, task manager, calendar, note app, therapist, or autonomous computer agent.

Surfaces:

- **Cairvia Orb** (Electron) — act
- **Cairvia Control Center** (web) — understand and control
- **Cairvia Companion** (Chrome MV3) — explicit selected text only

## Architecture

```text
Cairvia Orb / Extension / Control Center
        ↓
Cognito (deployed) or local SQLite
        ↓
API Gateway → Lambda   |   local Hono :47821
        ↓
DynamoDB Work Thread (canonical in AWS)
S3 optional artifacts (never desktop captures)
EventBridge cairvia.browser → Step Functions (commitment workflow)
Strands + Bedrock (bounded tools)
Agent Lambda = AgentCore Runtime HTTP contract
Cedar policy (READ_CONTEXT / CREATE_TASK / WRITE_LOCAL / SEND_EXTERNAL_MESSAGE / DELETE_DATA)
```

DynamoDB owns Work Thread state. Agent memory is not the source of truth. AgentCore Gateway is not simulated.

## Prerequisites

- Node.js 22+
- pnpm 10+ (`packageManager` in `package.json`)
- Windows, macOS, or Linux
- For AWS: AWS CLI, a non-root IAM profile, CDK v2 (via the repo)

This repo uses **pnpm**, not npm, for install. `workspace:*` is a pnpm protocol. Running `npm i` will fail.

```bash
corepack enable
pnpm --version
pnpm install
```

`npm run dev` is allowed only after `pnpm install`. Never use `npm i`.

Guides: `docs/CAIRVIA_ARCHITECTURE.md`, `docs/CAIRVIA_THREE_SURFACE_SYNC.md`, `docs/CAIRVIA_ORB_SETUP.md`, `docs/CAIRVIA_EXTENSION_SETUP.md`, `docs/CAIRVIA_WEBSITE_SETUP.md`, `docs/CAIRVIA_AWS_SETUP.md`, `docs/CAIRVIA_LOCAL_DEVELOPMENT.md`, `docs/CAIRVIA_TESTING.md`, `docs/CAIRVIA_SECURITY.md`, `docs/CAIRVIA_TROUBLESHOOTING.md`, `docs/CAIRVIA_DEMO_FLOW.md`.

## Local setup

```bash
pnpm install
pnpm test
pnpm seed
```

Local data: `%USERPROFILE%\.cairvia\cairvia.sqlite` or `~/.cairvia/cairvia.sqlite`.

If a previous seed already exists, delete that SQLite file before `pnpm seed` to load the CodeArena demo thread.

### Run

After `pnpm install`, one command starts the local API, Control Center, and Orb:

```bash
npm run dev
# same as: pnpm dev
```

That also writes the Chrome/Edge unpacked extension to `dist/extension`.

| Surface | How to use it |
| --- | --- |
| Website | http://127.0.0.1:5173 |
| API | http://127.0.0.1:47821 |
| Orb | appears bottom-right; **Ctrl+Shift+Space** (Cmd on macOS) shows or hides it |
| Extension | Chrome `chrome://extensions` or Edge `edge://extensions` → Developer mode → Load unpacked → **`dist/extension`** |

Keep the terminal open. Ctrl+C stops API, website, and Orb together.

Individual processes if you need them separately:

```bash
pnpm dev:api              # http://127.0.0.1:47821
pnpm dev:control-center   # http://127.0.0.1:5173
pnpm dev:desktop          # Cairvia Orb (starts its own API if :47821 is free)
pnpm build:extension      # refresh dist/extension
```

`pnpm lint` runs `pnpm typecheck` (there is no ESLint config). `pnpm build` builds packages that define a build script. `pnpm test` is the full Vitest suite.

If Electron skipped its install script:

```bash
node node_modules/electron/install.js
```

## Demo seed

Project **CodeArena**. Goal **Launch authentication**. Active task **OTP registration**. Blocker **SMTP timeout**. Next **inspect transporter logs**. One interruption capsule. One candidate: send the deployment report by Friday.

## Three-minute story

Interruptions force people to reconstruct context. Cairvia stores a Work Thread. Ask what to do next — one action. Work. Interrupt. Return. **Where was I?** Resume actually runs the stored LOW action. Confirm a meeting-style commitment. AWS holds identity, durable state, and the approval workflow.

Closing: **Cairvia keeps the thread until you can continue.**

## AWS setup

Use a sandbox account. Never use root keys. Never put credentials in React, the Orb renderer, or the extension.

```bash
aws configure --profile cairvia-hackathon
aws sts get-caller-identity --profile cairvia-hackathon
```

```bash
export AWS_PROFILE=cairvia-hackathon
pnpm --filter @cairvia/infrastructure bootstrap
pnpm synth
pnpm --filter @cairvia/infrastructure exec -- cdk diff
pnpm deploy -- -c demoPassword='set-via-cli-not-git'
```

Set the demo user password with `aws cognito-idp admin-set-user-password` (do not commit it).

```bash
TABLE_NAME=<TableName> DEMO_USER_ID=<cognito-sub> pnpm seed:cloud
```

Environment variables (never commit secrets):

```text
AWS_PROFILE / AWS_REGION
TABLE_NAME
DEMO_USER_ID
BEDROCK_MODEL_ID
EVENT_BUS_NAME          # set by Lambda env
CAIRVIA_WEB_ORIGIN
CAIRVIA_DETERMINISTIC_AGENT=1   # skip Bedrock in tests
```

Bedrock: enable the model in the account/region before a live agent invocation. Model access is not implied by having an AWS account.

AgentCore: this repo deploys a Lambda that implements `/v1/agent/ping` and `/v1/agent/invocations`. Do not invent a Gateway integration for slides. If you later use `npx @aws/agentcore`, compile TypeScript first (`esbuild` via CDK NodejsFunction already bundles the agent Lambda).

### Cleanup

```bash
pnpm --filter @cairvia/infrastructure exec -- cdk destroy
```

## Failure copy

- Offline: `You're offline. Your last saved context is available.`
- Tool: `The action did not complete. Nothing was marked as done.`
- Model: `Cairvia couldn't complete the reasoning step. Your Work Thread is safe.`
- Stale: `This recovery state may be outdated.`

## Adjacent products (do not claim first-ever)

| Category | Typical product | Overlap | Cairvia difference |
| --- | --- | --- | --- |
| Chat assistants | ChatGPT / Copilot | Language | Continuation state, not conversation |
| Task managers | Linear / Todoist | Work items | One next action + recovery capsule |
| Desktop agents | Computer-use agents | Execution | Allowlisted LOW tools, human approval |
| Note / memory apps | Mem / rewind tools | Recall | Evidence-based resume, not a transcript dump |

If differentiation is weak, sharpen the Orb recovery loop. Do not add features.

## Security

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- Allowlisted IPC only
- No renderer shell
- Cedar + action registry: HIGH tools cannot execute
- No AWS keys in the repository

## Troubleshooting

- Control Center empty on NOW: start `pnpm dev:api`. Recovery card is `/recovery/card`.
- Seed unchanged: SQLite already has a thread; delete `.cairvia/cairvia.sqlite`.
- Electron missing: `node node_modules/electron/install.js`
- Port 47821 in use: stop the previous API process.
