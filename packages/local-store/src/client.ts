import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import initSqlJs, { type Database } from "sql.js";
import { drizzle, type SQLJsDatabase } from "drizzle-orm/sql-js";
import { getDbPath } from "@cairvia/config";
import { applyMigrations } from "./migrate.js";
import * as schema from "./schema.js";

const require = createRequire(import.meta.url);

export type CairviaDb = SQLJsDatabase<typeof schema>;

export interface OpenedDb {
  sqlite: Database;
  db: CairviaDb;
  persist: () => void;
  close: () => void;
}

export async function createDb(dbPath: string = getDbPath()): Promise<OpenedDb> {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const SQL = await initSqlJs({
    locateFile: (file) => require.resolve(`sql.js/dist/${file}`)
  });
  const sqlite = fs.existsSync(dbPath)
    ? new SQL.Database(fs.readFileSync(dbPath))
    : new SQL.Database();
  applyMigrations(sqlite);
  const db = drizzle(sqlite, { schema });
  const persist = () => {
    fs.writeFileSync(dbPath, Buffer.from(sqlite.export()));
  };
  persist();
  return {
    sqlite,
    db,
    persist,
    close: () => {
      persist();
      sqlite.close();
    }
  };
}
