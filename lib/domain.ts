import type {
  Authorization,
  Channel,
  DB,
  Invitation,
  JournalEntry,
  MediaObject,
  NameDisplay,
  Revocation,
  Testimonial,
} from "./types";
import { CHANNEL_LABELS } from "./types";
import { newId } from "./crypto";
import { appendAudit } from "./audit";
import { addDays, todayStr } from "./dates";

export class DomainError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export const ALL_CHANNELS = Object.keys(CHANNEL_LABELS) as Channel[];
export const MIN_SECONDS = 60;
export const MAX_SECONDS = 120;

/** Marks authorizations past their expiration date as EXPIRED. */
export function refreshAuthorizationStatus(db: DB, now: Date = new Date()): void {
  const today = todayStr(now);
  for (const a of db.authorizations) {
    if (a.status === "ACTIVE" && a.expiresOn < today) a.status = "EXPIRED";
  }
}

export function activeAuthorizationFor(db: DB, invitationId: string, now: Date = new Date()): Authorization | null {
  refreshAuthorizationStatus(db, now);
  return db.authorizations.find((a) => a.invitationId === invitationId && a.status === "ACTIVE") ?? null;
}

export interface SignInput {
  channels: Channel[];
  nameDisplay: NameDisplay;
  blurFace: boolean;
  signedName: string;
  years: number;
  agreed: boolean;
}

export function signAuthorization(
  db: DB,
  invitation: Invitation,
  input: SignInput,
  ipHash: string,
  now: Date = new Date(),
): Authorization {
  const channels = Array.from(new Set(input.channels)).filter((c) => ALL_CHANNELS.includes(c));
  if (channels.length === 0) throw new DomainError("Choose at least one place we may share your story.");
  if (!["FIRST_NAME", "INITIALS", "NONE"].includes(input.nameDisplay)) throw new DomainError("Choose how your name is shown.");
  if (!input.agreed) throw new DomainError("Please confirm you have read the authorization.");
  const name = input.signedName.trim();
  if (name.length < 3) throw new DomainError("Type your full name to sign.");
  const years = Math.min(3, Math.max(1, Math.round(input.years)));
  const version = db.authorizationVersions
    .filter((v) => v.facilityId === invitation.facilityId)
    .sort((a, b) => b.version - a.version)[0];
  if (!version) throw new DomainError("No authorization form is set up for this facility.", 500);

  // A new signature replaces any earlier active one for this invitation.
  for (const a of db.authorizations) {
    if (a.invitationId === invitation.id && a.status === "ACTIVE") a.status = "REVOKED";
  }
  const auth: Authorization = {
    id: newId(),
    patientId: invitation.patientId,
    invitationId: invitation.id,
    facilityId: invitation.facilityId,
    versionId: version.id,
    channels,
    nameDisplay: input.nameDisplay,
    blurFace: input.blurFace,
    expiresOn: addDays(todayStr(now), Math.round(365.25 * years)),
    signedName: name,
    signedAt: now.toISOString(),
    signatureIpHash: ipHash,
    status: "ACTIVE",
    revokedAt: null,
  };
  db.authorizations.push(auth);
  appendAudit(
    db,
    {
      actorType: "PATIENT",
      actorId: invitation.patientId,
      action: "AUTHORIZATION_SIGNED",
      entity: "authorization",
      entityId: auth.id,
      facilityId: auth.facilityId,
      detail: { channels, nameDisplay: auth.nameDisplay, blurFace: auth.blurFace, expiresOn: auth.expiresOn, formVersion: version.version },
    },
    now,
  );
  return auth;
}

export function revokeAuthorization(
  db: DB,
  authorizationId: string,
  via: Revocation["requestedVia"],
  loggedBy: { type: "PATIENT" | "STAFF"; id: string },
  now: Date = new Date(),
): Revocation {
  const auth = db.authorizations.find((a) => a.id === authorizationId);
  if (!auth) throw new DomainError("Authorization not found.", 404);
  if (auth.status === "REVOKED") {
    const existing = db.revocations.find((r) => r.authorizationId === auth.id);
    if (existing) return existing;
  }
  auth.status = "REVOKED";
  auth.revokedAt = now.toISOString();
  const withdrawn: string[] = [];
  for (const t of db.testimonials) {
    if (t.authorizationId === auth.id && t.status !== "REJECTED") {
      t.status = "WITHDRAWN";
      withdrawn.push(t.id);
    }
  }
  const rev: Revocation = {
    id: newId(),
    authorizationId: auth.id,
    requestedVia: via,
    receivedAt: now.toISOString(),
    loggedBy: loggedBy.type === "PATIENT" ? "patient" : loggedBy.id,
    takedown: auth.channels.map((channel) => ({ channel, done: false, doneAt: null, doneBy: null })),
    confirmedAt: null,
  };
  db.revocations.push(rev);
  appendAudit(
    db,
    {
      actorType: loggedBy.type,
      actorId: loggedBy.id,
      action: "AUTHORIZATION_REVOKED",
      entity: "authorization",
      entityId: auth.id,
      facilityId: auth.facilityId,
      detail: { via, withdrawnTestimonials: withdrawn },
    },
    now,
  );
  return rev;
}

export function markTakedown(db: DB, revocationId: string, channel: Channel, staffId: string, done: boolean, now: Date = new Date()): Revocation {
  const rev = db.revocations.find((r) => r.id === revocationId);
  if (!rev) throw new DomainError("Revocation not found.", 404);
  const item = rev.takedown.find((t) => t.channel === channel);
  if (!item) throw new DomainError("Channel not on this takedown list.");
  item.done = done;
  item.doneAt = done ? now.toISOString() : null;
  item.doneBy = done ? staffId : null;
  rev.confirmedAt = rev.takedown.every((t) => t.done) ? now.toISOString() : null;
  const auth = db.authorizations.find((a) => a.id === rev.authorizationId);
  appendAudit(
    db,
    {
      actorType: "STAFF",
      actorId: staffId,
      action: done ? "TAKEDOWN_CONFIRMED" : "TAKEDOWN_REOPENED",
      entity: "revocation",
      entityId: rev.id,
      facilityId: auth?.facilityId ?? null,
      detail: { channel, allDone: rev.confirmedAt !== null },
    },
    now,
  );
  return rev;
}

export interface StoredVideo {
  objectKey: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  durationS: number;
}

export function createTestimonial(db: DB, invitation: Invitation, video: StoredVideo, now: Date = new Date()): Testimonial {
  const auth = activeAuthorizationFor(db, invitation.id, now);
  if (!auth) throw new DomainError("Please sign the authorization before submitting a video.", 403);
  if (video.durationS < 1 || video.durationS > MAX_SECONDS + 5) throw new DomainError("Videos must be 2 minutes or shorter.");
  const t: Testimonial = {
    id: newId(),
    invitationId: invitation.id,
    patientId: invitation.patientId,
    facilityId: invitation.facilityId,
    locationId: invitation.locationId,
    services: invitation.services,
    authorizationId: auth.id,
    ...video,
    status: "SUBMITTED",
    reviewerId: null,
    decisionReason: null,
    decidedAt: null,
    submittedAt: now.toISOString(),
  };
  db.testimonials.push(t);
  appendAudit(
    db,
    {
      actorType: "PATIENT",
      actorId: invitation.patientId,
      action: "TESTIMONIAL_SUBMITTED",
      entity: "testimonial",
      entityId: t.id,
      facilityId: t.facilityId,
      detail: { durationS: t.durationS, sizeBytes: t.sizeBytes, sha256: t.sha256 },
    },
    now,
  );
  return t;
}

export function decideTestimonial(
  db: DB,
  testimonialId: string,
  decision: "APPROVE" | "REJECT",
  reason: string,
  staffId: string,
  now: Date = new Date(),
): Testimonial {
  const t = db.testimonials.find((x) => x.id === testimonialId);
  if (!t) throw new DomainError("Video not found.", 404);
  if (t.status === "WITHDRAWN") throw new DomainError("This video was withdrawn because the patient revoked permission.", 409);
  if (decision === "APPROVE") {
    refreshAuthorizationStatus(db, now);
    const auth = db.authorizations.find((a) => a.id === t.authorizationId);
    if (!auth || auth.status !== "ACTIVE") throw new DomainError("The patient's authorization is not active, so this video can't be approved.", 409);
  } else if (reason.trim().length < 3) {
    throw new DomainError("Give a short reason for rejecting.");
  }
  t.status = decision === "APPROVE" ? "APPROVED" : "REJECTED";
  t.reviewerId = staffId;
  t.decisionReason = reason.trim() || null;
  t.decidedAt = now.toISOString();
  appendAudit(
    db,
    {
      actorType: "STAFF",
      actorId: staffId,
      action: decision === "APPROVE" ? "TESTIMONIAL_APPROVED" : "TESTIMONIAL_REJECTED",
      entity: "testimonial",
      entityId: t.id,
      facilityId: t.facilityId,
      detail: { reason: t.decisionReason },
    },
    now,
  );
  return t;
}

/** Throws unless the testimonial may be exported right now. */
export function assertExportable(db: DB, testimonialId: string, now: Date = new Date()): Testimonial {
  const t = db.testimonials.find((x) => x.id === testimonialId);
  if (!t) throw new DomainError("Video not found.", 404);
  if (t.status !== "APPROVED") throw new DomainError("Only approved videos can be exported.", 409);
  refreshAuthorizationStatus(db, now);
  const auth = db.authorizations.find((a) => a.id === t.authorizationId);
  if (!auth || auth.status !== "ACTIVE") throw new DomainError("The authorization is no longer active.", 409);
  return t;
}

// Words that route an entry to clinical staff with crisis resources.
// A clinician-reviewed list replaces this before any real use.
const CRISIS_PATTERNS = [
  /suicid/i,
  /kill myself/i,
  /end (it|my life)/i,
  /self[- ]?harm/i,
  /hurt myself/i,
  /no reason to live/i,
  /better off dead/i,
  /want to die/i,
];

export function needsCrisisFlag(text: string): boolean {
  return CRISIS_PATTERNS.some((p) => p.test(text));
}

export interface JournalInput {
  body: string;
  mood: number;
  sleep: number;
  energy: number;
  milestone: string | null;
  mediaId: string | null;
  sharedWithCareTeam: boolean;
}

function score(n: unknown): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v) || v < 0 || v > 10) throw new DomainError("Scores go from 0 to 10.");
  return v;
}

export function addJournalEntry(
  db: DB,
  patientId: string,
  treatmentPlanId: string | null,
  input: JournalInput,
  now: Date = new Date(),
): JournalEntry {
  const body = input.body.trim().slice(0, 5000);
  let media: MediaObject | undefined;
  if (input.mediaId) {
    media = db.media.find((m) => m.id === input.mediaId && m.patientId === patientId && m.attachedToEntryId === null);
    if (!media) throw new DomainError("That video couldn't be found. Please record it again.");
  }
  if (!body && !media) throw new DomainError("Write a few words or record a short video.");
  const entry: JournalEntry = {
    id: newId(),
    patientId,
    treatmentPlanId,
    entryDate: todayStr(now),
    body,
    mood: score(input.mood),
    sleep: score(input.sleep),
    energy: score(input.energy),
    milestone: input.milestone,
    mediaId: media?.id ?? null,
    sharedWithCareTeam: input.sharedWithCareTeam,
    flagged: needsCrisisFlag(body),
    createdAt: now.toISOString(),
  };
  if (media) media.attachedToEntryId = entry.id;
  db.journalEntries.push(entry);
  appendAudit(
    db,
    {
      actorType: "PATIENT",
      actorId: patientId,
      action: entry.flagged ? "JOURNAL_ENTRY_ADDED_FLAGGED" : "JOURNAL_ENTRY_ADDED",
      entity: "journal_entry",
      entityId: entry.id,
      facilityId: null,
      detail: { milestone: entry.milestone, hasVideo: Boolean(media) },
    },
    now,
  );
  return entry;
}
