import fs from "node:fs";
import path from "node:path";
import { dataDir } from "./db";

// PROTOTYPE STORAGE: files on local disk under data/objects.
// Phase 2 swaps this for private, encrypted S3 (SSE-KMS, block public access,
// signed URLs) behind the same three functions.

function objectsDir(): string {
  return path.join(dataDir(), "objects");
}

function resolveKey(key: string): string {
  if (!/^[a-z0-9-]+\/[a-z0-9-]+\.[a-z0-9]+$/i.test(key)) throw new Error("Invalid object key");
  return path.join(objectsDir(), key);
}

export function putObject(key: string, data: Buffer): void {
  const file = resolveKey(key);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data, { mode: 0o600 });
}

export function objectPath(key: string): string | null {
  const file = resolveKey(key);
  return fs.existsSync(file) ? file : null;
}

export function deleteObject(key: string): void {
  const file = resolveKey(key);
  if (fs.existsSync(file)) fs.rmSync(file);
}

export function extensionFor(mime: string): string {
  if (mime.startsWith("video/mp4")) return "mp4";
  if (mime.startsWith("video/quicktime")) return "mov";
  return "webm";
}

export const MAX_UPLOAD_BYTES = 250 * 1024 * 1024;
