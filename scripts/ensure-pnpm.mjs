const agent = process.env.npm_config_user_agent ?? "";
const execPath = process.env.npm_execpath ?? "";
const usingPnpm =
  agent.includes("pnpm") || execPath.replace(/\\/g, "/").includes("/pnpm");

if (!usingPnpm) {
  console.error(`
Cairvia is a pnpm workspace. npm cannot install it.

  workspace:* is a pnpm protocol npm does not understand.
  npm i therefore spends a long time resolving peers, then fails with
  EUNSUPPORTEDPROTOCOL

Use:

  corepack enable
  corepack prepare pnpm@10.14.0 --activate
  pnpm install
  pnpm dev

npm run dev is fine AFTER pnpm install. Do not use npm i.
`);
  process.exit(1);
}
