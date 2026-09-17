import os from "node:os";
import path from "node:path";
import { DB_FILENAME } from "./constants.js";

export function getDataDir(): string {
  if (process.env.CAIRVIA_DATA_DIR) {
    return process.env.CAIRVIA_DATA_DIR;
  }
  return path.join(os.homedir(), ".cairvia");
}

export function getDbPath(): string {
  return path.join(getDataDir(), DB_FILENAME);
}
