import { requireStaff } from "@/lib/session";
import { readDb } from "@/lib/db";
import { inScope } from "@/lib/rbac";
import { MAX_CODE_ATTEMPTS } from "@/lib/invites";
import { PROTOCOL_LABELS, SERVICE_LABELS, type ProtocolCode, type ServiceCode } from "@/lib/types";
import { fmtDateTime, todayStr } from "@/lib/dates";
import StaffShell, { FacilityBadge } from "@/components/StaffShell";
import InviteForm from "@/components/InviteForm";

export const dynamic = "force-dynamic";

const PURPOSE_LABELS = { TESTIMONIAL: "Video story", JOURNAL: "Journal", BOTH: "Video story + journal" } as const;

export default async function Invitations() {
  const staff = await requireStaff("invites.manage");
  const db = readDb();
  const facilities = db.facilities.filter((f) => inScope(staff, f.id));
  const locations = db.locations.filter((l) => l.active && inScope(staff, l.facilityId));
  const now = Date.now();
  const rows = db.invitations.filter((i) => inScope(staff, i.facilityId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100);
  return (
    <StaffShell user={staff} active="/staff/invitations">
      <div className="s-head">
        <div>
          <h1>Invitations</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            Send the link and the code separately (for example, link by text and code by email, or code read out at the front desk).
          </p>
        </div>
      </div>
      <InviteForm
        facilities={facilities.map((f) => ({ id: f.id, name: f.legalName }))}
        locations={locations.map((l) => ({ id: l.id, facilityId: l.facilityId, name: l.name }))}
        services={(Object.keys(SERVICE_LABELS) as ServiceCode[]).map((s) => ({ value: s, label: SERVICE_LABELS[s] }))}
        protocols={(Object.keys(PROTOCOL_LABELS) as ProtocolCode[]).map((p) => ({ value: p, label: PROTOCOL_LABELS[p] }))}
        today={todayStr()}
      />
      <h2 className="eyebrow" style={{ marginTop: 8 }}>
        Recent invitations
      </h2>
      <div className="table-box">
        <table className="s-table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Location</th>
              <th>For</th>
              <th>Plan</th>
              <th>Created</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => {
              const p = db.patients.find((x) => x.id === i.patientId);
              const f = db.facilities.find((x) => x.id === i.facilityId)!;
              const l = db.locations.find((x) => x.id === i.locationId);
              const plan = db.treatmentPlans.find((x) => x.id === i.treatmentPlanId);
              const expired = new Date(i.expiresAt).getTime() < now;
              const locked = i.failedAttempts >= MAX_CODE_ATTEMPTS;
              return (
                <tr key={i.id}>
                  <td>
                    {p?.firstName} {p?.lastName}
                    <br />
                    <FacilityBadge code={f.code} name={f.name} />
                  </td>
                  <td>{l?.name}</td>
                  <td>{PURPOSE_LABELS[i.purpose]}</td>
                  <td>{plan ? PROTOCOL_LABELS[plan.protocol] : "—"}</td>
                  <td>{fmtDateTime(i.createdAt)}</td>
                  <td>
                    {locked ? (
                      <span className="badge bad">Locked</span>
                    ) : expired ? (
                      <span className="badge">Expired</span>
                    ) : i.firstUsedAt ? (
                      <span className="badge good">Opened</span>
                    ) : (
                      <span className="badge warn">Not opened yet</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </StaffShell>
  );
}
