import { execSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const isWin = process.platform === "win32";
const LOCAL_API_ORIGIN = "http://127.0.0.1:47821";
const CONTROL_CENTER_ORIGIN = "http://127.0.0.1:5173";
const PORTS = [47821, 5173, 5174];
const children = [];
let shuttingDown = false;

function pnpmBin() {
  return isWin ? "pnpm.cmd" : "pnpm";
}

function spawnPnpm(args, options = {}) {
  return spawn(pnpmBin(), args, {
    cwd: root,
    env: { ...process.env, ...(options.env ?? {}) },
    stdio: options.stdio ?? "inherit",
    shell: isWin,
    windowsHide: options.windowsHide === true
  });
}

function prefix(label, chunk, isErr) {
  const text = String(chunk).replace(/\r/g, "").trimEnd();
  if (!text) {
    return;
  }
  const stream = isErr ? process.stderr : process.stdout;
  for (const line of text.split("\n")) {
    stream.write(`[${label}] ${line}\n`);
  }
}

function run(label, args, extraEnv = {}) {
  const child = spawnPnpm(args, {
    env: extraEnv,
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout?.on("data", (chunk) => prefix(label, chunk, false));
  child.stderr?.on("data", (chunk) => prefix(label, chunk, true));
  child.on("exit", (code) => {
    if (!shuttingDown && code && code !== 0) {
      console.error(`[${label}] exited with code ${code}`);
    }
  });
  children.push(child);
  return child;
}

function runOnce(args) {
  return new Promise((resolve, reject) => {
    const child = spawnPnpm(args, { stdio: "inherit" });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${args.join(" ")} failed (${code ?? "unknown"})`));
      }
    });
    child.on("error", reject);
  });
}

async function waitFor(url, timeoutMs, label) {
  const started = Date.now();
  let lastError = "not started";
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok) {
        return;
      }
      lastError = String(response.status);
    } catch (error) {
      lastError = error instanceof Error ? error.message : "unreachable";
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`Timed out waiting for ${label} at ${url} (${lastError})`);
}

function pidsListeningOn(port) {
  try {
    const output = execSync("netstat -ano", {
      encoding: "utf8",
      windowsHide: true
    });
    const pids = new Set();
    for (const line of output.split(/\r?\n/)) {
      if (!line.includes("LISTENING")) {
        continue;
      }
      const local = line.match(/TCP\s+\S+:(\d+)\s+/i);
      if (!local || Number(local[1]) !== port) {
        continue;
      }
      const pid = line.trim().split(/\s+/).pop();
      if (pid && /^\d+$/.test(pid) && pid !== "0") {
        pids.add(pid);
      }
    }
    return [...pids];
  } catch {
    return [];
  }
}

function taskkillPid(pid) {
  try {
    execSync(`taskkill /PID ${pid} /T /F`, {
      stdio: "ignore",
      windowsHide: true
    });
  } catch {
    /* already gone */
  }
}

function killCairviaElectron() {
  if (isWin) {
    try {
      execSync(`taskkill /FI "WINDOWTITLE eq Cairvia Orb*" /T /F`, {
        stdio: "ignore",
        windowsHide: true
      });
    } catch {
      /* none */
    }
    const marker = root.replace(/'/g, "''");
    const ps = [
      `$root = '${marker}'`,
      "Get-CimInstance Win32_Process | Where-Object {",
      "  $_.CommandLine -and $_.CommandLine.Contains($root) -and (",
      "    $_.Name -eq 'electron.exe' -or $_.CommandLine -match 'electron(\\.exe|\\.cmd)?'",
      "  )",
      "} | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
    ].join("; ");
    try {
      execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command ${JSON.stringify(ps)}`, {
        stdio: "ignore",
        windowsHide: true
      });
    } catch {
      /* none */
    }
    return;
  }
  try {
    execSync(`pkill -f ${JSON.stringify(`${root}.*electron`)}`, {
      stdio: "ignore"
    });
  } catch {
    /* none */
  }
}

function freeCairviaPorts() {
  const mine = String(process.pid);
  const killed = new Set();
  for (const port of PORTS) {
    for (const pid of pidsListeningOn(port)) {
      if (pid === mine || killed.has(pid)) {
        continue;
      }
      killed.add(pid);
      console.log(`Cairvia — freeing port ${port} (pid ${pid})`);
      if (isWin) {
        taskkillPid(pid);
      } else {
        try {
          process.kill(Number(pid), "SIGTERM");
        } catch {
          /* already gone */
        }
      }
    }
  }
}

function stopLeftovers() {
  killCairviaElectron();
  freeCairviaPorts();
}

function shutdown() {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log("Cairvia — stopping Orb, website, and API…");
  for (const child of children) {
    if (!child.pid) {
      continue;
    }
    if (isWin) {
      taskkillPid(child.pid);
    } else {
      try {
        child.kill("SIGTERM");
      } catch {
        /* already gone */
      }
    }
  }
  stopLeftovers();
}

function exitAfterShutdown() {
  shutdown();
  process.exit(0);
}

process.on("SIGINT", exitAfterShutdown);
process.on("SIGTERM", exitAfterShutdown);
process.on("SIGHUP", exitAfterShutdown);
process.on("SIGBREAK", exitAfterShutdown);

console.log("Cairvia — stopping leftover API / website / Orb processes…");
stopLeftovers();
await new Promise((resolve) => setTimeout(resolve, 1500));

console.log("Cairvia — building Chrome/Edge extension dist…");
await runOnce(["build:extension"]);

console.log("Cairvia — starting local API…");
run("api", ["--filter", "@cairvia/api", "dev"]);
await waitFor(`${LOCAL_API_ORIGIN}/health`, 45_000, "local API");

console.log("Cairvia — starting Control Center…");
run("web", ["--filter", "@cairvia/control-center", "dev"]);
await waitFor(CONTROL_CENTER_ORIGIN, 45_000, "Control Center");

console.log("Cairvia — starting Orb as a desktop overlay…");
const orb = run("orb", ["--filter", "@cairvia/desktop", "dev:orb"], {
  CAIRVIA_EXTERNAL_API: "1",
  ELECTRON_RENDERER_URL: ""
});
orb.on("exit", (code) => {
  if (!shuttingDown && code && code !== 0) {
    console.error(
      "Cairvia Orb failed to start. Close other npm run dev windows and try again."
    );
  }
});

const hotkey =
  process.platform === "darwin" ? "Cmd+Shift+Space" : "Ctrl+Shift+Space";

console.log(`
Cairvia is running — one product, three surfaces

  Website     ${CONTROL_CENTER_ORIGIN}
  API         ${LOCAL_API_ORIGIN}
  Orb         desktop overlay (no browser tab); ${hotkey} shows or hides it
  Extension   load unpacked:
                dist/extension
              Chrome  chrome://extensions
              Edge    edge://extensions

Run only one npm run dev. Keep this terminal open.
Ctrl+C (keep this terminal open) stops API, website, and Orb together.
`);

await new Promise(() => undefined);
