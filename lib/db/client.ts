import "server-only";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

export const DB_PATH = path.join(process.cwd(), "data", "bible.db");

// One read-only connection per server process; survives dev HMR via globalThis.
const globalForDb = globalThis as unknown as { bibleDb?: Database.Database };

function open() {
  const sqlite = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  sqlite.pragma("query_only = ON");
  return sqlite;
}

export const sqlite = globalForDb.bibleDb ?? open();
if (process.env.NODE_ENV !== "production") globalForDb.bibleDb = sqlite;

export const db = drizzle(sqlite, { schema });
