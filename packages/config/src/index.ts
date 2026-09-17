import os from "node:os";
import path from "node:path";

export const APP_NAME = "Cairvia";
export const LOCAL_API_HOST = "127.0.0.1";
export const LOCAL_API_PORT = 47821;
export const LOCAL_API_ORIGIN = `http://${LOCAL_API_HOST}:${LOCAL_API_PORT}`;
export const CONTROL_CENTER_ORIGIN = "http://127.0.0.1:5173";
export const GLOBAL_SHORTCUT = "CommandOrControl+Shift+Space";
export const DB_FILENAME = "cairvia.sqlite";

export function getDataDir(): string {
  if (process.env.CAIRVIA_DATA_DIR) {
    return process.env.CAIRVIA_DATA_DIR;
  }
  return path.join(os.homedir(), ".cairvia");
}

export function getDbPath(): string {
  return path.join(getDataDir(), DB_FILENAME);
}
