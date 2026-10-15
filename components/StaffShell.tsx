import Link from "next/link";
import type { StaffUser } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";
import { can } from "@/lib/rbac";
import { readDb } from "@/lib/db";
import { STAFF_NAV as NAV, homeFor } from "@/lib/staffnav";
import SignOutButton from "./SignOutButton";

export { homeFor };

export default function StaffShell({ user, active, children }: { user: StaffUser; active: string; children: React.ReactNode }) {
  const db = readDb();
  const scoped = (facilityId: string) => user.facilityScope.length === 0 || user.facilityScope.includes(facilityId);
  const counts: Record<string, number> = {
    "/staff/queue": db.testimonials.filter((t) => t.status === "SUBMITTED" && scoped(t.facilityId)).length,
    "/staff/authorizations": db.revocations.filter((r) => !r.confirmedAt && scoped(db.authorizations.find((a) => a.id === r.authorizationId)?.facilityId ?? "")).length,
    "/staff/flags": db.journalEntries.filter((e) => e.flagged && scoped(db.treatmentPlans.find((p) => p.id === e.treatmentPlanId)?.facilityId ?? "")).length,
  };
  const scopeLabel =
    user.facilityScope.length === 0 ? "Both facilities" : user.facilityScope.map((id) => db.facilities.find((f) => f.id === id)?.name).join(", ");
  return (
    <div className="s-layout">
      <nav className="s-nav" aria-label="Staff">
        <div className="s-logos">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/advanced-tms.png" alt="Advanced TMS Clinic, Inc." />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/pacific-health.png" alt="Pacific Health Systems" />
        </div>
        <div className="s-brand">Patient Stories</div>
        <div className="s-sub">Staff console · sample data</div>
        {NAV.filter((n) => can(user, n.perm)).map((n) => (
          <Link key={n.href} href={n.href} aria-current={active === n.href ? "page" : undefined}>
            <span>{n.label}</span>
            {counts[n.href] ? <span className="badge warn">{counts[n.href]}</span> : null}
          </Link>
        ))}
        <div className="who">
          <span>
            {user.name}
            <br />
            {ROLE_LABELS[user.role]} · {scopeLabel}
          </span>
          <SignOutButton endpoint="/api/staff/logout" to="/staff/login" className="" />
        </div>
      </nav>
      <main className="s-main">{children}</main>
    </div>
  );
}

export function FacilityBadge({ code, name }: { code: "ATMS" | "PHS"; name: string }) {
  return <span className={`badge ${code === "ATMS" ? "atms" : "phs"}`}>{name}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "APPROVED" || status === "ACTIVE"
      ? "good"
      : status === "REJECTED" || status === "REVOKED" || status === "WITHDRAWN" || status === "EXPIRED"
        ? "bad"
        : status === "SUBMITTED"
          ? "warn"
          : "";
  const label = status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");
  return <span className={`badge ${cls}`}>{status === "SUBMITTED" ? "Needs review" : label}</span>;
}
