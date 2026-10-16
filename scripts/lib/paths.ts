import path from "node:path";

export const ROOT = path.resolve(import.meta.dirname, "..", "..");
export const RAW = path.join(ROOT, "data", "raw");
export const DB_FILE = path.join(ROOT, "data", "bible.db");
export const MIGRATIONS = path.join(ROOT, "lib", "db", "migrations");
