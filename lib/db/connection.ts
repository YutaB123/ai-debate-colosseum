import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const SCHEMA_PATH = path.join(process.cwd(), "lib", "db", "schema.sql");

export type DB = ReturnType<typeof Database>;

export function openDb(file: string = "./data/debate.db"): DB {
  if (file !== ":memory:") {
    const dir = path.dirname(file);
    fs.mkdirSync(dir, { recursive: true });
  }
  const db = new Database(file);
  db.pragma("foreign_keys = ON");
  const schema = fs.readFileSync(SCHEMA_PATH, "utf8");
  db.exec(schema);
  return db;
}

let singleton: DB | null = null;

export function getDb(): DB {
  if (!singleton) {
    singleton = openDb(process.env.DEBATE_DB_PATH ?? "./data/debate.db");
  }
  return singleton;
}
