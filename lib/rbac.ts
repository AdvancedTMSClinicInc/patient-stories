import type { Role, StaffUser } from "./types";

export type Permission =
  | "testimonials.view"
  | "testimonials.decide"
  | "testimonials.export"
  | "invites.manage"
  | "authorizations.manage"
  | "plans.manage"
  | "followups.manage"
  | "flags.view"
  | "audit.view";

// Marketing roles never see journals or check-in videos; clinical roles never
// approve marketing use. Keep these two sides apart.
const MATRIX: Record<Role, Permission[]> = {
  ADMIN: [
    "testimonials.view",
    "testimonials.decide",
    "testimonials.export",
    "invites.manage",
    "authorizations.manage",
    "plans.manage",
    "followups.manage",
    "flags.view",
    "audit.view",
  ],
  PRIVACY_OFFICER: ["testimonials.view", "invites.manage", "authorizations.manage", "audit.view"],
  MARKETING_REVIEWER: ["testimonials.view", "testimonials.decide", "testimonials.export"],
  CLINIC_STAFF: ["invites.manage", "plans.manage", "followups.manage", "flags.view"],
  AUDITOR: ["audit.view"],
};

export function can(user: Pick<StaffUser, "role">, perm: Permission): boolean {
  return MATRIX[user.role].includes(perm);
}

export function inScope(user: Pick<StaffUser, "facilityScope">, facilityId: string | null): boolean {
  if (facilityId === null) return user.facilityScope.length === 0;
  return user.facilityScope.length === 0 || user.facilityScope.includes(facilityId);
}

export function permissionsFor(role: Role): Permission[] {
  return [...MATRIX[role]];
}
