import fs from "node:fs";
import path from "node:path";
import type { DB } from "./types";
import { buildSeed } from "./seed";

// PROTOTYPE STORE: one JSON file on local disk, sample data only.
// Phase 2 replaces this module with PostgreSQL (row-level security, encryption
// at rest, backups). Keep all reads and writes going through readDb/mutate so
// the swap touches one file.

export function dataDir(): string {
  return process.env.DATA_DIR ?? path.join(process.cwd(), "data");
}

function dbFile(): string {
  return path.join(dataDir(), "db.json");
}

function ensureDb(): void {
  const file = dbFile();
  if (fs.existsSync(file)) return;
  fs.mkdirSync(dataDir(), { recursive: true });
  const { db, devInvites } = buildSeed(new Date());
  writeAtomic(file, JSON.stringify(db, null, 2));
  writeAtomic(path.join(dataDir(), "dev-invites.json"), JSON.stringify(devInvites, null, 2));
}

function writeAtomic(file: string, contents: string): void {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, contents, { mode: 0o600 });
  fs.renameSync(tmp, file);
}

export function readDb(): DB {
  ensureDb();
  return JSON.parse(fs.readFileSync(dbFile(), "utf8")) as DB;
}

/**
 * Read, change and save in one synchronous step. Node runs this without
 * interleaving, so two requests can't overwrite each other's changes.
 */
export function mutate<T>(fn: (db: DB) => T): T {
  const db = readDb();
  const result = fn(db);
  writeAtomic(dbFile(), JSON.stringify(db, null, 2));
  return result;
}

export interface DevInvite {
  patient: string;
  facility: string;
  location: string;
  plan: string;
  path: string;
  code: string;
}

export function readDevInvites(): DevInvite[] {
  ensureDb();
  const file = path.join(dataDir(), "dev-invites.json");
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, "utf8")) as DevInvite[];
}

export function appendDevInvite(invite: DevInvite): void {
  const list = readDevInvites();
  list.unshift(invite);
  writeAtomic(path.join(dataDir(), "dev-invites.json"), JSON.stringify(list.slice(0, 50), null, 2));
}
