import { getDbPath } from "@cairvia/config";
import { createDb } from "./client.js";
import { seedIfEmpty } from "./seed.js";
import { SqliteThreadStore } from "./thread-repo.js";

const opened = await createDb(getDbPath());
const store = new SqliteThreadStore(opened.db, opened.persist);
const thread = await seedIfEmpty(store);
opened.close();
console.log(`Seeded Work Thread ${thread.id} at ${getDbPath()}`);
