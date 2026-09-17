import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createAppKernel } from "@cairvia/local-store";

describe("offline queue and restart", () => {
  it("keeps the Work Thread after close/reopen of the database", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cairvia-offline-"));
    const dbPath = path.join(dir, "cairvia.sqlite");
    const first = await createAppKernel(dbPath);
    const id = first.seed.id;
    first.sqlite.close();

    const second = await createAppKernel(dbPath);
    const again = await second.threads.getThread(id);
    expect(again.intent).toBe("Fix authentication");
    expect(again.nextAction).toContain("mailer");
    const pending = await second.store.listPendingSync();
    expect(pending.length).toBeGreaterThan(0);
    second.sqlite.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
