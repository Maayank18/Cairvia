# Security

- Electron: `contextIsolation`, no `nodeIntegration`, sandbox, allowlisted IPC.
- Renderer CSP: `default-src 'self'` plus `connect-src` to the local API for SSE.
- Tools: LOW only at runtime; HIGH `delete_data` denied.
- Extension: selection + title only; provenance shown in the popup.
- CORS: Control Center origins and `chrome-extension://`.
- DynamoDB conditional writes; thread `expectedVersion`.
- Cedar: CREATE_TASK requires user approval; SEND_EXTERNAL_MESSAGE and DELETE_DATA forbid.
- No AWS keys in the repo.

`innerHTML` in the extension popup interpolates candidate text from the local API after the user selected it. Do not pipe untrusted remote HTML into that path.
