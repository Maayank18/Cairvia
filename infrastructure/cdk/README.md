# Phase 3 AWS

Reproducible stack for Cognito, API Gateway HTTP API, Lambda, DynamoDB, encrypted S3, EventBridge, Step Functions, and the Strands/Bedrock agent runtime Lambda.

AgentCore Gateway is **not** simulated. The agent Lambda implements the AgentCore Runtime HTTP contract (`GET /v1/agent/ping`, `POST /v1/agent/invocations`). DynamoDB is the source of truth for Work Threads. Agent memory, if added later, is not canonical application state.

## Bootstrap

```bash
aws configure
cd infrastructure/cdk
pnpm install
pnpm bootstrap
```

## Build / synth / deploy

From the repo root after `pnpm install`:

```bash
pnpm --filter @cairvia/infrastructure synth
pnpm --filter @cairvia/infrastructure deploy -- -c demoPassword='YourDemoPass1!'
```

Outputs: `ApiUrl`, `UserPoolId`, `UserPoolClientId`, `TableName`.

Create or confirm the demo user in Cognito (`demo@cairvia.dev`) and set a password that satisfies the pool policy. Do not commit passwords.

## Seed demo data

```bash
TABLE_NAME=<output> DEMO_USER_ID=<cognito-sub> pnpm seed:cloud
```

Seeds CodeArena / Launch authentication / OTP registration / SMTP timeout / inspect transporter logs, one interrupted recovery capsule, and one candidate commitment (`Send deployment report` / Friday).

## Smoke tests

```bash
pnpm test
CAIRVIA_API_URL=<ApiUrl> CAIRVIA_JWT=<idToken> pnpm --filter @cairvia/cloud-api exec vitest run src/http.test.ts
```

Local smoke (no AWS) is included in `pnpm test` via Phase 3 evaluation tests.
