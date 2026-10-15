import type { DB, Invitation, InvitePurpose, Patient, ProtocolCode, ServiceCode, TreatmentPlan } from "./types";
import { newId, randomToken, sha256, sixDigitCode } from "./crypto";
import { appendAudit } from "./audit";

export const TESTIMONIAL_INVITE_DAYS = 7;
export const JOURNAL_INVITE_DAYS = 180;
export const MAX_CODE_ATTEMPTS = 5;

export interface NewInviteInput {
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  facilityId: string;
  locationId: string;
  services: ServiceCode[];
  purpose: InvitePurpose;
  protocol: ProtocolCode;
  startDate: string;
  sessionsCompleted?: number;
}

export interface NewInviteResult {
  invitation: Invitation;
  patient: Patient;
  plan: TreatmentPlan;
  token: string;
  code: string;
}

/**
 * Creates the patient, their treatment plan and an invitation. Only hashes of
 * the link token and the code are stored; the plain values are returned once.
 */
export function createInvitation(
  db: DB,
  input: NewInviteInput,
  actorId: string,
  now: Date = new Date(),
): NewInviteResult {
  const nowIso = now.toISOString();
  const patient: Patient = {
    id: newId(),
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    preferredLang: "en",
    createdAt: nowIso,
  };
  const plan: TreatmentPlan = {
    id: newId(),
    patientId: patient.id,
    facilityId: input.facilityId,
    locationId: input.locationId,
    protocol: input.protocol,
    startDate: input.startDate,
    sessionsCompleted: input.sessionsCompleted ?? 0,
    lastSessionAt: null,
    status: "ACTIVE",
    createdAt: nowIso,
  };
  const token = randomToken();
  const code = sixDigitCode();
  const days = input.purpose === "TESTIMONIAL" ? TESTIMONIAL_INVITE_DAYS : JOURNAL_INVITE_DAYS;
  const invitation: Invitation = {
    id: newId(),
    patientId: patient.id,
    facilityId: input.facilityId,
    locationId: input.locationId,
    services: input.services,
    purpose: input.purpose,
    treatmentPlanId: plan.id,
    tokenHash: sha256(token),
    codeHash: sha256(code),
    expiresAt: new Date(now.getTime() + days * 86_400_000).toISOString(),
    firstUsedAt: null,
    failedAttempts: 0,
    createdBy: actorId,
    createdAt: nowIso,
  };
  db.patients.push(patient);
  db.treatmentPlans.push(plan);
  db.invitations.push(invitation);
  appendAudit(
    db,
    {
      actorType: actorId === "system" ? "SYSTEM" : "STAFF",
      actorId,
      action: "INVITATION_CREATED",
      entity: "invitation",
      entityId: invitation.id,
      facilityId: input.facilityId,
      detail: { purpose: input.purpose, protocol: input.protocol, expiresAt: invitation.expiresAt },
    },
    now,
  );
  return { invitation, patient, plan, token, code };
}

export type VerifyOutcome =
  | { ok: true; invitation: Invitation }
  | { ok: false; reason: "NOT_FOUND" | "EXPIRED" | "LOCKED" | "WRONG_CODE"; attemptsLeft?: number };

/** Checks a link token + code pair and records the attempt. */
export function verifyInvite(db: DB, token: string, code: string, now: Date = new Date()): VerifyOutcome {
  const tokenHash = sha256(token);
  const invitation = db.invitations.find((i) => i.tokenHash === tokenHash);
  if (!invitation) return { ok: false, reason: "NOT_FOUND" };
  if (new Date(invitation.expiresAt).getTime() < now.getTime()) return { ok: false, reason: "EXPIRED" };
  if (invitation.failedAttempts >= MAX_CODE_ATTEMPTS) return { ok: false, reason: "LOCKED" };
  if (sha256(code.trim()) !== invitation.codeHash) {
    invitation.failedAttempts += 1;
    appendAudit(
      db,
      {
        actorType: "PATIENT",
        actorId: invitation.patientId,
        action: "INVITE_CODE_FAILED",
        entity: "invitation",
        entityId: invitation.id,
        facilityId: invitation.facilityId,
        detail: { failedAttempts: invitation.failedAttempts },
      },
      now,
    );
    const left = MAX_CODE_ATTEMPTS - invitation.failedAttempts;
    return left <= 0 ? { ok: false, reason: "LOCKED" } : { ok: false, reason: "WRONG_CODE", attemptsLeft: left };
  }
  invitation.failedAttempts = 0;
  invitation.firstUsedAt ??= now.toISOString();
  appendAudit(
    db,
    {
      actorType: "PATIENT",
      actorId: invitation.patientId,
      action: "PATIENT_SIGNED_IN",
      entity: "invitation",
      entityId: invitation.id,
      facilityId: invitation.facilityId,
    },
    now,
  );
  return { ok: true, invitation };
}
