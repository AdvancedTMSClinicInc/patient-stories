// Shared data types. The prototype keeps everything in one JSON file (lib/db.ts);
// Phase 2 moves these to PostgreSQL with the same shapes.

export type FacilityCode = "ATMS" | "PHS";
export type ServiceCode = "THERAPY" | "PSYCHIATRY" | "TMS" | "SPRAVATO";
export type ProtocolCode =
  | "TMS_STANDARD"
  | "TMS_ACCELERATED"
  | "TMS_ONE_DAY"
  | "SPRAVATO"
  | "THERAPY"
  | "PSYCHIATRY";
export type Role = "ADMIN" | "PRIVACY_OFFICER" | "MARKETING_REVIEWER" | "CLINIC_STAFF" | "AUDITOR";
export type Channel =
  | "WEBSITE"
  | "FACEBOOK_INSTAGRAM"
  | "YOUTUBE"
  | "GOOGLE_BUSINESS"
  | "PAID_ADS"
  | "IN_CLINIC_PRINT"
  | "INTERNAL_TRAINING";
export type NameDisplay = "FIRST_NAME" | "INITIALS" | "NONE";
export type TestimonialStatus = "SUBMITTED" | "APPROVED" | "REJECTED" | "WITHDRAWN";
export type AuthorizationStatus = "ACTIVE" | "REVOKED" | "EXPIRED";
export type InvitePurpose = "TESTIMONIAL" | "JOURNAL" | "BOTH";

export interface Facility {
  id: string;
  code: FacilityCode;
  name: string;
  legalName: string;
  privacyOfficerEmail: string;
}

export interface Location {
  id: string;
  facilityId: string;
  name: string;
  address: string;
  googleReviewUrl: string;
  active: boolean;
}

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  preferredLang: "en" | "es";
  createdAt: string;
}

export interface Invitation {
  id: string;
  patientId: string;
  facilityId: string;
  locationId: string;
  services: ServiceCode[];
  purpose: InvitePurpose;
  treatmentPlanId: string | null;
  tokenHash: string;
  codeHash: string;
  expiresAt: string;
  firstUsedAt: string | null;
  failedAttempts: number;
  createdBy: string;
  createdAt: string;
}

export interface PatientSession {
  id: string; // sha256 of the cookie value
  invitationId: string;
  createdAt: string;
  lastSeenAt: string;
}

export interface StaffUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  facilityScope: string[]; // facility ids; empty = both facilities
  disabled: boolean;
}

export interface StaffSession {
  id: string; // sha256 of the cookie value
  staffId: string;
  createdAt: string;
  lastSeenAt: string;
}

export interface AuthorizationVersion {
  id: string;
  facilityId: string;
  version: number;
  body: string;
  effectiveAt: string;
  legalApprovedBy: string | null;
}

export interface Authorization {
  id: string;
  patientId: string;
  invitationId: string;
  facilityId: string;
  versionId: string;
  channels: Channel[];
  nameDisplay: NameDisplay;
  blurFace: boolean;
  expiresOn: string; // YYYY-MM-DD
  signedName: string;
  signedAt: string;
  signatureIpHash: string;
  status: AuthorizationStatus;
  revokedAt: string | null;
}

export interface TakedownItem {
  channel: Channel;
  done: boolean;
  doneAt: string | null;
  doneBy: string | null;
}

export interface Revocation {
  id: string;
  authorizationId: string;
  requestedVia: "APP" | "EMAIL" | "PHONE" | "MAIL";
  receivedAt: string;
  loggedBy: string; // "patient" or staff id
  takedown: TakedownItem[];
  confirmedAt: string | null;
}

export interface Testimonial {
  id: string;
  invitationId: string;
  patientId: string;
  facilityId: string;
  locationId: string;
  services: ServiceCode[];
  authorizationId: string;
  objectKey: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  durationS: number;
  status: TestimonialStatus;
  reviewerId: string | null;
  decisionReason: string | null;
  decidedAt: string | null;
  submittedAt: string;
}

export interface MediaObject {
  id: string;
  patientId: string;
  objectKey: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  durationS: number;
  createdAt: string;
  attachedToEntryId: string | null;
}

export interface JournalEntry {
  id: string;
  patientId: string;
  treatmentPlanId: string | null;
  entryDate: string; // YYYY-MM-DD
  body: string;
  mood: number; // 0-10
  sleep: number; // 0-10
  energy: number; // 0-10
  milestone: string | null;
  mediaId: string | null;
  sharedWithCareTeam: boolean;
  flagged: boolean;
  createdAt: string;
}

export interface TreatmentPlan {
  id: string;
  patientId: string;
  facilityId: string;
  locationId: string;
  protocol: ProtocolCode;
  startDate: string; // YYYY-MM-DD
  sessionsCompleted: number;
  lastSessionAt: string | null;
  status: "ACTIVE" | "COMPLETED";
  createdAt: string;
}

export interface ReminderLog {
  id: string;
  treatmentPlanId: string;
  patientId: string;
  dueOn: string;
  sentAt: string;
  sentBy: string;
  via: "GHL_MOCK" | "GHL";
  toPhoneMasked: string;
  message: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  actorType: "STAFF" | "PATIENT" | "SYSTEM";
  actorId: string;
  action: string;
  entity: string;
  entityId: string;
  facilityId: string | null;
  detail: Record<string, unknown>;
  prevHash: string;
  hash: string;
}

export interface DB {
  version: 1;
  facilities: Facility[];
  locations: Location[];
  patients: Patient[];
  invitations: Invitation[];
  patientSessions: PatientSession[];
  staff: StaffUser[];
  staffSessions: StaffSession[];
  authorizationVersions: AuthorizationVersion[];
  authorizations: Authorization[];
  revocations: Revocation[];
  testimonials: Testimonial[];
  media: MediaObject[];
  journalEntries: JournalEntry[];
  treatmentPlans: TreatmentPlan[];
  reminders: ReminderLog[];
  audit: AuditEntry[];
}

export const SERVICE_LABELS: Record<ServiceCode, string> = {
  THERAPY: "Therapy",
  PSYCHIATRY: "Psychiatry",
  TMS: "TMS",
  SPRAVATO: "Spravato",
};

export const CHANNEL_LABELS: Record<Channel, string> = {
  WEBSITE: "Practice website",
  FACEBOOK_INSTAGRAM: "Facebook and Instagram",
  YOUTUBE: "YouTube",
  GOOGLE_BUSINESS: "Google Business Profile",
  PAID_ADS: "Paid advertising",
  IN_CLINIC_PRINT: "In-clinic screens and print",
  INTERNAL_TRAINING: "Internal staff training only",
};

export const PROTOCOL_LABELS: Record<ProtocolCode, string> = {
  TMS_STANDARD: "TMS, standard course (36 sessions)",
  TMS_ACCELERATED: "TMS, accelerated (SAINT-style, 5 days)",
  TMS_ONE_DAY: "One-Day TMS (20 sessions in one day)",
  SPRAVATO: "Spravato",
  THERAPY: "Therapy",
  PSYCHIATRY: "Psychiatry",
};

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrator",
  PRIVACY_OFFICER: "Privacy officer",
  MARKETING_REVIEWER: "Marketing reviewer",
  CLINIC_STAFF: "Clinic staff",
  AUDITOR: "Auditor",
};
