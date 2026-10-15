import type { StaffUser } from "./types";
import { can, type Permission } from "./rbac";

export interface NavItem {
  href: string;
  label: string;
  perm: Permission;
}

export const STAFF_NAV: NavItem[] = [
  { href: "/staff/queue", label: "Review queue", perm: "testimonials.view" },
  { href: "/staff/invitations", label: "Invitations", perm: "invites.manage" },
  { href: "/staff/authorizations", label: "Authorizations", perm: "authorizations.manage" },
  { href: "/staff/plans", label: "Treatment plans", perm: "plans.manage" },
  { href: "/staff/followups", label: "12-week follow-ups", perm: "followups.manage" },
  { href: "/staff/flags", label: "Care team alerts", perm: "flags.view" },
  { href: "/staff/audit", label: "Audit log", perm: "audit.view" },
];

export function homeFor(user: Pick<StaffUser, "role">): string {
  return STAFF_NAV.find((n) => can(user, n.perm))?.href ?? "/staff/forbidden";
}
