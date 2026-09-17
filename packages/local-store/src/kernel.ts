import { ThreadService } from "@cairvia/domain";
import { createDb } from "./client.js";
import { seedIfEmpty } from "./seed.js";
import { SqliteThreadStore } from "./thread-repo.js";

export async function createAppKernel(dbPath?: string) {
  const opened = await createDb(dbPath);
  const store = new SqliteThreadStore(opened.db, opened.persist);
  const thread = await seedIfEmpty(store);
  const threads = new ThreadService(store);
  return { sqlite: opened, store, threads, seed: thread, persist: opened.persist };
}
