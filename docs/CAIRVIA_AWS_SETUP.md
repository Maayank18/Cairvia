# AWS setup

Use a sandbox account and a **non-root** IAM user/role.

```bash
aws configure --profile cairvia-hackathon
aws sts get-caller-identity --profile cairvia-hackathon
```

If a command differs on your CLI, run `<command> --help` and current AWS docs.

```bash
export AWS_PROFILE=cairvia-hackathon
export AWS_REGION=us-east-1
pnpm --filter @cairvia/infrastructure bootstrap
pnpm synth
pnpm --filter @cairvia/infrastructure exec -- cdk diff
pnpm deploy -- -c demoPassword='set-via-cli-not-git'
```

Set the Cognito demo password with `aws cognito-idp admin-set-user-password` (never commit it).

```bash
TABLE_NAME=<output> DEMO_USER_ID=<cognito-sub> pnpm seed:cloud
```

## What is created (costs money)

Cognito, HTTP API, Lambdas, DynamoDB pay-per-request, encrypted private S3, EventBridge bus, Step Functions, CloudWatch logs. Bedrock invocations if the agent Lambda is used.

```bash
pnpm --filter @cairvia/infrastructure exec -- cdk destroy
```

## Responsibilities

| Service | Role |
| --- | --- |
| Cognito | JWT identity |
| API Gateway HTTP API | authenticated `/v1` |
| Lambda | thin HTTP + workflow + agent runtime |
| DynamoDB | canonical Work Thread |
| S3 | optional artifacts, not captures |
| EventBridge | `cairvia.browser` ContextCaptured |
| Step Functions | commitment approval wait |
| Bedrock + Strands | bounded agent tools |
| Agent Lambda | AgentCore Runtime HTTP contract |
| Cedar (local) | READ_CONTEXT / CREATE_TASK / … |
| CloudWatch | logs |
| CDK | IaC |

AgentCore Gateway and AgentCore Memory are **not** implemented (would be fake if added for slides).
