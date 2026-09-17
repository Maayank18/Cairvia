import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ThreadService } from "@cairvia/domain";
import { createDb } from "./client.js";
import { seedIfEmpty } from "./seed.js";
import { SqliteThreadStore } from "./thread-repo.js";

const dirs: string[] = [];

function tempDb(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cairvia-"));
  dirs.push(dir);
  return path.join(dir, "cairvia.sqlite");
}

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("SQLite persistence", () => {
  it("writes and reloads a Work Thread", async () => {
    const dbPath = tempDb();
    const first = await createDb(dbPath);
    const store = new SqliteThreadStore(first.db, first.persist);
    const seeded = await seedIfEmpty(store);
    expect(seeded.intent).toBe("Fix authentication");
    first.close();

    const second = await createDb(dbPath);
    const reloaded = await new SqliteThreadStore(second.db, second.persist).getThread(
      seeded.id
    );
    expect(reloaded?.nextAction).toBe("Run mailer health check");
    second.close();
  });

  it("stores an immutable recovery capsule", async () => {
    const first = await createDb(tempDb());
    const store = new SqliteThreadStore(first.db, first.persist);
    const thread = await seedIfEmpty(store);
    const service = new ThreadService(store);
    await service.resumeThread(thread.id);
    const captured = await service.captureRecovery(thread.id);
    const latest = await store.getLatestCapsule(thread.id);
    expect(latest?.id).toBe(captured.recoveryCapsule?.id);
    expect(latest?.currentState).toContain("SMTP");
    first.close();
  });
});
