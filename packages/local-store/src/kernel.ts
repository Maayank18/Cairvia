import { ThreadService, ContinuityService, SyncHub } from "@cairvia/domain";
import { createDb } from "./client.js";
import { seedIfEmpty } from "./seed.js";
import { SqliteThreadStore } from "./thread-repo.js";

export async function createAppKernel(dbPath?: string) {
  const opened = await createDb(dbPath);
  const store = new SqliteThreadStore(opened.db, opened.persist);
  const hub = new SyncHub();
  const thread = await seedIfEmpty(store);
  const threads = new ThreadService(store, { hub, userId: "local" });
  const continuity = new ContinuityService(store);
  return {
    sqlite: opened,
    store,
    threads,
    continuity,
    hub,
    seed: thread,
    persist: opened.persist
  };
}
