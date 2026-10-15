import Link from "next/link";
import { requireStaff } from "@/lib/session";
import { readDb } from "@/lib/db";
import { inScope } from "@/lib/rbac";
import { refreshAuthorizationStatus } from "@/lib/domain";
import { SERVICE_LABELS, type ServiceCode, type TestimonialStatus } from "@/lib/types";
import { fmtDateTime } from "@/lib/dates";
import StaffShell, { FacilityBadge, StatusBadge } from "@/components/StaffShell";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function Queue({ searchParams }: { searchParams: Promise<SP> }) {
  const staff = await requireStaff("testimonials.view");
  const sp = await searchParams;
  const facility = one(sp.facility);
  const location = one(sp.location);
  const service = one(sp.service) as ServiceCode | "";
  const status = (one(sp.status) || "SUBMITTED") as TestimonialStatus | "ALL";

  const db = readDb();
  refreshAuthorizationStatus(db);
  const facilities = db.facilities.filter((f) => inScope(staff, f.id));
  const locations = db.locations.filter((l) => inScope(staff, l.facilityId) && (!facility || l.facilityId === facility));
  const rows = db.testimonials
    .filter((t) => inScope(staff, t.facilityId))
    .filter((t) => !facility || t.facilityId === facility)
    .filter((t) => !location || t.locationId === location)
    .filter((t) => !service || t.services.includes(service))
    .filter((t) => status === "ALL" || t.status === status)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

  return (
    <StaffShell user={staff} active="/staff/queue">
      <div className="s-head">
        <div>
          <h1>Review queue</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            Only videos with an active patient authorization can be approved or exported.
          </p>
        </div>
      </div>

      <form className="filters" method="get" aria-label="Filters">
        <label>
          Facility
          <select name="facility" defaultValue={facility}>
            <option value="">All in my scope</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.legalName}
              </option>
            ))}
          </select>
        </label>
        <label>
          Location
          <select name="location" defaultValue={location}>
            <option value="">All locations</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {db.facilities.find((f) => f.id === l.facilityId)?.code === "ATMS" ? "Advanced TMS" : "Pacific"} · {l.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Service
          <select name="service" defaultValue={service}>
            <option value="">All services</option>
            {(Object.keys(SERVICE_LABELS) as ServiceCode[]).map((s) => (
              <option key={s} value={s}>
                {SERVICE_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select name="status" defaultValue={status}>
            <option value="SUBMITTED">Needs review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="WITHDRAWN">Withdrawn (revoked)</option>
            <option value="ALL">All</option>
          </select>
        </label>
        <button className="btn btn-navy btn-small" type="submit">
          Apply
        </button>
      </form>

      <div className="table-box">
        <table className="s-table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Service</th>
              <th>Location</th>
              <th>Length</th>
              <th>Submitted</th>
              <th>Authorization</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="muted">
                  Nothing here yet. Videos appear after a patient submits one. To try it, open a sample patient link from the home page.
                </td>
              </tr>
            ) : (
              rows.map((t) => {
                const p = db.patients.find((x) => x.id === t.patientId);
                const f = db.facilities.find((x) => x.id === t.facilityId)!;
                const l = db.locations.find((x) => x.id === t.locationId);
                const a = db.authorizations.find((x) => x.id === t.authorizationId);
                return (
                  <tr key={t.id}>
                    <td>
                      <Link href={`/staff/testimonials/${t.id}`}>
                        {p?.firstName} {p?.lastName.charAt(0)}.
                      </Link>
                      <br />
                      <FacilityBadge code={f.code} name={f.name} />
                    </td>
                    <td>{t.services.map((s) => SERVICE_LABELS[s]).join(", ")}</td>
                    <td>{l?.name}</td>
                    <td>
                      {Math.floor(t.durationS / 60)}:{String(t.durationS % 60).padStart(2, "0")}
                    </td>
                    <td>{fmtDateTime(t.submittedAt)}</td>
                    <td>
                      {a ? <StatusBadge status={a.status} /> : <span className="badge bad">Missing</span>}
                      {a?.status === "ACTIVE" ? <span className="small muted"> · {a.channels.length} channels</span> : null}
                    </td>
                    <td>
                      <StatusBadge status={t.status} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </StaffShell>
  );
}
