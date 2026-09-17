# Environment variables

See `.env.example` in the repo root. Copy to `.env` locally if needed; `.env` is gitignored.

Never put `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, session tokens, or Cognito passwords in Git, README, or frontend bundles.

Local Orb / Control Center / Extension talk to `http://127.0.0.1:47821` from `@cairvia/config`. There is no API key for the local kernel.
