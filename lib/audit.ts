import type { AuditEntry, DB } from "./types";
import { newId, sha256 } from "./crypto";

export const GENESIS_HASH = "0".repeat(64);

type NewAudit = Omit<AuditEntry, "id" | "at" | "prevHash" | "hash" | "facilityId" | "detail"> & {
  facilityId?: string | null;
  detail?: Record<string, unknown>;
};

function hashOf(e: Omit<AuditEntry, "hash">): string {
  return sha256(
    JSON.stringify([
      e.id,
      e.at,
      e.actorType,
      e.actorId,
      e.action,
      e.entity,
      e.entityId,
      e.facilityId,
      e.detail,
      e.prevHash,
    ]),
  );
}

/** Appends a tamper-evident entry: each entry's hash covers the previous hash. */
export function appendAudit(db: DB, input: NewAudit, now: Date = new Date()): AuditEntry {
  const prev = db.audit.at(-1);
  const base: Omit<AuditEntry, "hash"> = {
    id: newId(),
    at: now.toISOString(),
    actorType: input.actorType,
    actorId: input.actorId,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId,
    facilityId: input.facilityId ?? null,
    detail: input.detail ?? {},
    prevHash: prev ? prev.hash : GENESIS_HASH,
  };
  const entry: AuditEntry = { ...base, hash: hashOf(base) };
  db.audit.push(entry);
  return entry;
}

/** Returns the index of the first broken link, or -1 if the chain is intact. */
export function verifyAuditChain(entries: AuditEntry[]): number {
  let prev = GENESIS_HASH;
  for (let i = 0; i < entries.length; i++) {
    const { hash, ...rest } = entries[i];
    if (rest.prevHash !== prev || hashOf(rest) !== hash) return i;
    prev = hash;
  }
  return -1;
}
