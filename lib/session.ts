import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { readDb, mutate } from "./db";
import { randomToken, sha256, hashIp } from "./crypto";
import { BRANDS, type Brand } from "./brand";
import { activeAuthorizationFor } from "./domain";
import { can, type Permission } from "./rbac";
import type { Authorization, Facility, Invitation, Location, Patient, StaffUser, TreatmentPlan } from "./types";

const PATIENT_COOKIE = "ps_session";
const STAFF_COOKIE = "ss_session";
const PATIENT_IDLE_MS = 30 * 60 * 1000;
const STAFF_MAX_MS = 8 * 60 * 60 * 1000;

const secure = process.env.NODE_ENV === "production";

export async function clientIpHash(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip");
  return hashIp(ip);
}

// ---------- Patients ----------

export interface PatientContext {
  invitation: Invitation;
  patient: Patient;
  facility: Facility;
  location: Location;
  plan: TreatmentPlan | null;
  brand: Brand;
  authorization: Authorization | null;
}

export async function startPatientSession(invitationId: string): Promise<void> {
  const token = randomToken();
  const now = new Date();
  mutate((db) => {
    db.patientSessions = db.patientSessions.filter((s) => now.getTime() - new Date(s.lastSeenAt).getTime() < PATIENT_IDLE_MS);
    db.patientSessions.push({ id: sha256(token), invitationId, createdAt: now.toISOString(), lastSeenAt: now.toISOString() });
  });
  (await cookies()).set(PATIENT_COOKIE, token, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 12 * 60 * 60 });
}

export async function endPatientSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(PATIENT_COOKIE)?.value;
  if (token) mutate((db) => void (db.patientSessions = db.patientSessions.filter((s) => s.id !== sha256(token))));
  jar.delete(PATIENT_COOKIE);
}

/** Returns the signed-in patient's context, or null if there's no valid session. */
export async function getPatientContext(): Promise<PatientContext | null> {
  const token = (await cookies()).get(PATIENT_COOKIE)?.value;
  if (!token) return null;
  const id = sha256(token);
  const now = new Date();
  const db = readDb();
  const session = db.patientSessions.find((s) => s.id === id);
  if (!session || now.getTime() - new Date(session.lastSeenAt).getTime() > PATIENT_IDLE_MS) return null;
  const invitation = db.invitations.find((i) => i.id === session.invitationId);
  if (!invitation || new Date(invitation.expiresAt).getTime() < now.getTime()) return null;
  mutate((d) => {
    const s = d.patientSessions.find((x) => x.id === id);
    if (s) s.lastSeenAt = now.toISOString();
  });
  const patient = db.patients.find((p) => p.id === invitation.patientId)!;
  const facility = db.facilities.find((f) => f.id === invitation.facilityId)!;
  const location = db.locations.find((l) => l.id === invitation.locationId)!;
  const plan = db.treatmentPlans.find((p) => p.id === invitation.treatmentPlanId) ?? null;
  return {
    invitation,
    patient,
    facility,
    location,
    plan,
    brand: BRANDS[facility.code],
    authorization: activeAuthorizationFor(db, invitation.id, now),
  };
}

export async function requirePatient(): Promise<PatientContext> {
  const ctx = await getPatientContext();
  if (!ctx) redirect("/expired");
  return ctx;
}

// ---------- Staff ----------
// PROTOTYPE: staff pick a sample account on /staff/login. Phase 2 replaces this
// with SSO (Okta / Microsoft Entra) and required MFA.

export async function startStaffSession(staffId: string): Promise<void> {
  const token = randomToken();
  const now = new Date();
  mutate((db) => {
    db.staffSessions = db.staffSessions.filter((s) => now.getTime() - new Date(s.createdAt).getTime() < STAFF_MAX_MS);
    db.staffSessions.push({ id: sha256(token), staffId, createdAt: now.toISOString(), lastSeenAt: now.toISOString() });
  });
  (await cookies()).set(STAFF_COOKIE, token, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: STAFF_MAX_MS / 1000 });
}

export async function endStaffSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(STAFF_COOKIE)?.value;
  if (token) mutate((db) => void (db.staffSessions = db.staffSessions.filter((s) => s.id !== sha256(token))));
  jar.delete(STAFF_COOKIE);
}

export async function getStaff(): Promise<StaffUser | null> {
  const token = (await cookies()).get(STAFF_COOKIE)?.value;
  if (!token) return null;
  const id = sha256(token);
  const db = readDb();
  const session = db.staffSessions.find((s) => s.id === id);
  if (!session || Date.now() - new Date(session.createdAt).getTime() > STAFF_MAX_MS) return null;
  const staff = db.staff.find((s) => s.id === session.staffId);
  return staff && !staff.disabled ? staff : null;
}

export async function requireStaff(perm?: Permission): Promise<StaffUser> {
  const staff = await getStaff();
  if (!staff) redirect("/staff/login");
  if (perm && !can(staff, perm)) redirect("/staff/forbidden");
  return staff;
}
