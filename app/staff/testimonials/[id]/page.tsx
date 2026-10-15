import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/session";
import { mutate, readDb } from "@/lib/db";
import { appendAudit } from "@/lib/audit";
import { can, inScope } from "@/lib/rbac";
import { refreshAuthorizationStatus } from "@/lib/domain";
import { CHANNEL_LABELS, SERVICE_LABELS } from "@/lib/types";
import { fmtDateTime, fmtDayYear } from "@/lib/dates";
import StaffShell, { FacilityBadge, StatusBadge } from "@/components/StaffShell";
import DecisionForm from "@/components/DecisionForm";

export const dynamic = "force-dynamic";

const NAME_LABELS = { FIRST_NAME: "First name only", INITIALS: "Initials only", NONE: "No name" } as const;

export default async function TestimonialDetail({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff("testimonials.view");
  const { id } = await params;
  const db = readDb();
  refreshAuthorizationStatus(db);
  const t = db.testimonials.find((x) => x.id === id);
  if (!t || !inScope(staff, t.facilityId)) notFound();
  mutate((d) =>
    appendAudit(d, { actorType: "STAFF", actorId: staff.id, action: "TESTIMONIAL_VIEWED", entity: "testimonial", entityId: t.id, facilityId: t.facilityId }),
  );
  const p = db.patients.find((x) => x.id === t.patientId);
  const f = db.facilities.find((x) => x.id === t.facilityId)!;
  const l = db.locations.find((x) => x.id === t.locationId);
  const a = db.authorizations.find((x) => x.id === t.authorizationId);
  const reviewer = t.reviewerId ? db.staff.find((s) => s.id === t.reviewerId) : null;
  const canDecide = can(staff, "testimonials.decide");
  const canExport = can(staff, "testimonials.export") && t.status === "APPROVED" && a?.status === "ACTIVE";

  return (
    <StaffShell user={staff} active="/staff/queue">
      <Link href="/staff/queue" className="small">
        ← Review queue
      </Link>
      <div className="s-head">
        <h1>
          {p?.firstName} {p?.lastName.charAt(0)}. · {t.services.map((s) => SERVICE_LABELS[s]).join(", ")}
        </h1>
        <StatusBadge status={t.status} />
      </div>
      <div className="grid-2">
        <section className="stack">
          <video src={`/api/staff/video/${t.id}`} controls playsInline preload="metadata" className="video-frame" />
          <p className="small muted" style={{ margin: 0 }}>
            {Math.floor(t.durationS / 60)}:{String(t.durationS % 60).padStart(2, "0")} · {(t.sizeBytes / 1_048_576).toFixed(1)} MB · submitted{" "}
            {fmtDateTime(t.submittedAt)} · SHA-256 <span className="mono">{t.sha256.slice(0, 16)}…</span>
          </p>
          <p className="small muted" style={{ margin: 0 }}>
            Every view, decision and export is recorded in the audit log.
          </p>
        </section>
        <aside className="stack">
          <section className="card">
            <h2>Where it came from</h2>
            <dl className="details-grid">
              <dt>Facility</dt>
              <dd>
                <FacilityBadge code={f.code} name={f.legalName} />
              </dd>
              <dt>Location</dt>
              <dd>{l?.name}</dd>
              <dt>Services</dt>
              <dd>{t.services.map((s) => SERVICE_LABELS[s]).join(", ")}</dd>
            </dl>
          </section>
          <section className="card">
            <h2>Patient authorization</h2>
            {a ? (
              <dl className="details-grid">
                <dt>Status</dt>
                <dd>
                  <StatusBadge status={a.status} />
                </dd>
                <dt>Channels</dt>
                <dd>{a.channels.map((c) => CHANNEL_LABELS[c]).join(", ")}</dd>
                <dt>Name shown</dt>
                <dd>{NAME_LABELS[a.nameDisplay]}</dd>
                <dt>Face</dt>
                <dd>{a.blurFace ? "Must be blurred" : "May be shown"}</dd>
                <dt>Signed</dt>
                <dd>{fmtDateTime(a.signedAt)}</dd>
                <dt>Expires</dt>
                <dd>{fmtDayYear(a.expiresOn)}</dd>
              </dl>
            ) : (
              <p className="error">No authorization on file.</p>
            )}
          </section>
          {t.decidedAt ? (
            <section className="card">
              <h2>Decision</h2>
              <p style={{ margin: 0 }}>
                {t.status === "APPROVED" ? "Approved" : t.status === "REJECTED" ? "Rejected" : t.status} by {reviewer?.name ?? "staff"} on{" "}
                {fmtDateTime(t.decidedAt)}
                {t.decisionReason ? `: “${t.decisionReason}”` : ""}
              </p>
            </section>
          ) : null}
          {canDecide && t.status === "SUBMITTED" ? <DecisionForm testimonialId={t.id} canApprove={a?.status === "ACTIVE"} /> : null}
          {canExport ? (
            <a className="btn btn-gold" href={`/api/staff/export/${t.id}`}>
              Download approved video
            </a>
          ) : null}
          {t.status === "WITHDRAWN" ? (
            <p className="notice" style={{ margin: 0 }}>
              The patient revoked permission. Don't use this video anywhere. Check the takedown list on the Authorizations page.
            </p>
          ) : null}
        </aside>
      </div>
    </StaffShell>
  );
}
