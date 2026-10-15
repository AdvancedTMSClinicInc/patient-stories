import type { DB, Facility, Location, ProtocolCode, ServiceCode, StaffUser, InvitePurpose } from "./types";
import { PROTOCOL_LABELS } from "./types";
import { createInvitation } from "./invites";
import { addDays, todayStr } from "./dates";
import { newId } from "./crypto";
import type { DevInvite } from "./db";

// Everything here is SAMPLE DATA. No real patients, ever, until the security
// and legal review is done (Gate 4 in the plan).

export const FACILITIES: Facility[] = [
  {
    id: "fac-atms",
    code: "ATMS",
    name: "Advanced TMS Clinic",
    legalName: "Advanced TMS Clinic Inc",
    privacyOfficerEmail: "privacy@example.com",
  },
  {
    id: "fac-phs",
    code: "PHS",
    name: "Pacific Health Systems",
    legalName: "Pacific Health Systems LP",
    privacyOfficerEmail: "privacy@example.com",
  },
];

const ADDR = {
  nationalCity: "610 Euclid Ave, Suite 200, National City, CA 91950",
  santee: "8772 Cuyamaca St, Suite 104, Santee, CA 92071",
  oceanside: "2122 S El Camino Real, Suite 200, Oceanside, CA 92054",
};

export const LOCATIONS: Location[] = [
  { id: "loc-atms-nc", facilityId: "fac-atms", name: "National City", address: ADDR.nationalCity, googleReviewUrl: "https://g.page/r/CXP9K23mpE3iEAE/review", active: true },
  { id: "loc-atms-santee", facilityId: "fac-atms", name: "Santee", address: ADDR.santee, googleReviewUrl: "https://g.page/r/CUhBp4jzSifYEAE/review", active: true },
  { id: "loc-atms-ocean", facilityId: "fac-atms", name: "Oceanside", address: ADDR.oceanside, googleReviewUrl: "https://g.page/r/CXOgtvsNUAbOEAE/review", active: true },
  { id: "loc-phs-nc", facilityId: "fac-phs", name: "National City", address: ADDR.nationalCity, googleReviewUrl: "https://g.page/r/CZRj4lKJI74TEAE/review", active: true },
  { id: "loc-phs-santee", facilityId: "fac-phs", name: "Santee", address: ADDR.santee, googleReviewUrl: "https://g.page/r/CXh86hsghwhtEAE/review", active: true },
  { id: "loc-phs-ocean", facilityId: "fac-phs", name: "Oceanside", address: ADDR.oceanside, googleReviewUrl: "https://g.page/r/CcIxpFXX0ZGBECE/review", active: true },
];

export const SAMPLE_STAFF: StaffUser[] = [
  { id: "staff-admin", email: "admin@example.com", name: "Avery Admin (sample)", role: "ADMIN", facilityScope: [], disabled: false },
  { id: "staff-privacy", email: "privacy@example.com", name: "Pat Privacy (sample)", role: "PRIVACY_OFFICER", facilityScope: [], disabled: false },
  { id: "staff-marketing", email: "marketing@example.com", name: "Morgan Marketing (sample)", role: "MARKETING_REVIEWER", facilityScope: [], disabled: false },
  { id: "staff-clinic-atms", email: "clinic.atms@example.com", name: "Casey Clinic, Advanced TMS only (sample)", role: "CLINIC_STAFF", facilityScope: ["fac-atms"], disabled: false },
  { id: "staff-clinic-phs", email: "clinic.phs@example.com", name: "Jamie Clinic, Pacific only (sample)", role: "CLINIC_STAFF", facilityScope: ["fac-phs"], disabled: false },
  { id: "staff-auditor", email: "auditor@example.com", name: "Alex Auditor (sample)", role: "AUDITOR", facilityScope: [], disabled: false },
];

export const AUTHORIZATION_BODY = `AUTHORIZATION TO USE MY STORY IN MARKETING  [DRAFT — COUNSEL TO FINALIZE]

1. What will be used: the video I record, my voice, my name as I choose below, the service I received, and the facility and location where I was treated.
2. Who will use and share it: {FACILITY} and the agencies and platforms it uses to publish the channels I select.
3. Purpose: marketing and promotion of {FACILITY}.
4. This authorization expires on the date shown below unless I revoke it sooner.
5. I may revoke this authorization at any time, in writing or through this app. Revoking stops future use but cannot undo uses that already happened.
6. My treatment, payment, enrollment and eligibility for benefits do not depend on whether I sign.
7. Once my story is published, people outside {FACILITY} may share it, and it may no longer be protected by federal privacy law.
8. I will receive a copy of this authorization.`;

interface SamplePatient {
  first: string;
  last: string;
  locationId: string;
  services: ServiceCode[];
  protocol: ProtocolCode;
  startDaysAgo: number;
  sessions: number;
  purpose: InvitePurpose;
}

const SAMPLE_PATIENTS: SamplePatient[] = [
  { first: "Jordan", last: "Sample", locationId: "loc-atms-santee", services: ["TMS"], protocol: "TMS_STANDARD", startDaysAgo: 24, sessions: 18, purpose: "BOTH" },
  { first: "Maria", last: "Sample", locationId: "loc-phs-ocean", services: ["THERAPY"], protocol: "THERAPY", startDaysAgo: 40, sessions: 0, purpose: "BOTH" },
  { first: "Alex", last: "Sample", locationId: "loc-phs-santee", services: ["SPRAVATO", "PSYCHIATRY"], protocol: "SPRAVATO", startDaysAgo: 17, sessions: 5, purpose: "BOTH" },
  { first: "Sam", last: "Sample", locationId: "loc-atms-nc", services: ["TMS"], protocol: "TMS_ONE_DAY", startDaysAgo: 21, sessions: 20, purpose: "BOTH" },
  { first: "Riley", last: "Sample", locationId: "loc-atms-ocean", services: ["TMS"], protocol: "TMS_ACCELERATED", startDaysAgo: 2, sessions: 20, purpose: "BOTH" },
  { first: "Taylor", last: "Sample", locationId: "loc-atms-santee", services: ["TMS"], protocol: "TMS_STANDARD", startDaysAgo: 150, sessions: 36, purpose: "JOURNAL" },
];

export function emptyDb(): DB {
  return {
    version: 1,
    facilities: [],
    locations: [],
    patients: [],
    invitations: [],
    patientSessions: [],
    staff: [],
    staffSessions: [],
    authorizationVersions: [],
    authorizations: [],
    revocations: [],
    testimonials: [],
    media: [],
    journalEntries: [],
    treatmentPlans: [],
    reminders: [],
    audit: [],
  };
}

export function buildSeed(now: Date): { db: DB; devInvites: DevInvite[] } {
  const db = emptyDb();
  db.facilities = structuredClone(FACILITIES);
  db.locations = structuredClone(LOCATIONS);
  db.staff = structuredClone(SAMPLE_STAFF);
  for (const f of db.facilities) {
    db.authorizationVersions.push({
      id: newId(),
      facilityId: f.id,
      version: 1,
      body: AUTHORIZATION_BODY.replaceAll("{FACILITY}", f.legalName),
      effectiveAt: now.toISOString(),
      legalApprovedBy: null,
    });
  }
  const today = todayStr(now);
  const devInvites: DevInvite[] = [];
  for (const p of SAMPLE_PATIENTS) {
    const loc = db.locations.find((l) => l.id === p.locationId)!;
    const fac = db.facilities.find((f) => f.id === loc.facilityId)!;
    const result = createInvitation(
      db,
      {
        firstName: p.first,
        lastName: p.last,
        phone: "+1 555 0100",
        email: null,
        facilityId: fac.id,
        locationId: loc.id,
        services: p.services,
        purpose: p.purpose,
        protocol: p.protocol,
        startDate: addDays(today, -p.startDaysAgo),
        sessionsCompleted: p.sessions,
      },
      "system",
      now,
    );
    devInvites.push({
      patient: `${p.first} ${p.last}`,
      facility: fac.name,
      location: loc.name,
      plan: PROTOCOL_LABELS[p.protocol],
      path: `/i/${result.token}`,
      code: result.code,
    });
  }
  return { db, devInvites };
}
