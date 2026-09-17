# Demo flow

1. Start API, Control Center, Orb; load the extension.
2. Orb shows CodeArena / Launch authentication (or create via API `POST /v1/threads`).
3. “What should I do next?” — stored next action only.
4. Select “Please send the deployment report by Friday.” → Send to Cairvia.
5. Control Center AUTOMATIONS / THREADS evidence updates via SSE.
6. THREADS: change next action → Orb panel refresh via SSE (no browser reload).
7. Orb Stop → recovery capsule.
8. Quit and reopen Orb → Welcome Back.
9. Resume → real LOW action.
10. Website status matches. Mention Cognito, API Gateway, Lambda, DynamoDB, EventBridge, Step Functions, Bedrock — only as implemented.
