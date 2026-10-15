import { requireStaff } from "@/lib/session";
import { readDb } from "@/lib/db";
import { inScope } from "@/lib/rbac";
import { fmtDateTime } from "@/lib/dates";
import StaffShell, { FacilityBadge } from "@/components/StaffShell";

export const dynamic = "force-dynamic";

// Clinical view only. Marketing roles can't open this page.
export default async function Flags() {
  const staff = await requireStaff("flags.view");
  const db = readDb();
  const facilityOf = (planId: string | null) => db.treatmentPlans.find((p) => p.id === planId)?.facilityId ?? null;
  const visible = db.journalEntries.filter((e) => {
    const fid = facilityOf(e.treatmentPlanId);
    return fid !== null && inScope(staff, fid);
  });
  const flagged = visible.filter((e) => e.flagged).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const shared = visible.filter((e) => e.sharedWithCareTeam && !e.flagged).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const card = (e: (typeof visible)[number], urgent: boolean) => {
    const p = db.patients.find((x) => x.id === e.patientId);
    const f = db.facilities.find((x) => x.id === facilityOf(e.treatmentPlanId))!;
    return (
      <article key={e.id} className="card" style={urgent ? { borderColor: "var(--bad)" } : undefined}>
        <div className="row">
          <strong>
            {p?.firstName} {p?.lastName}
          </strong>
          <FacilityBadge code={f.code} name={f.name} />
          <span className="small muted">{fmtDateTime(e.createdAt)}</span>
          <span className="spacer" />
          <span className="small">
            Mood {e.mood} · Sleep {e.sleep} · Energy {e.energy}
          </span>
        </div>
        {e.body ? <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{e.body}</p> : <p className="muted small" style={{ margin: 0 }}>Video only.</p>}
      </article>
    );
  };

  return (
    <StaffShell user={staff} active="/staff/flags">
      <div className="s-head">
        <div>
          <h1>Care team alerts</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            Journal entries with crisis language, and entries patients chose to share. Follow your clinic&apos;s crisis protocol.
            The word list that triggers alerts must be reviewed by your clinicians before real use.
          </p>
        </div>
      </div>
      <h2 className="eyebrow">Needs attention</h2>
      {flagged.length === 0 ? <p className="muted small" style={{ margin: 0 }}>No flagged entries.</p> : flagged.map((e) => card(e, true))}
      <h2 className="eyebrow" style={{ marginTop: 8 }}>
        Shared with the care team
      </h2>
      {shared.length === 0 ? <p className="muted small" style={{ margin: 0 }}>Nothing shared yet.</p> : shared.map((e) => card(e, false))}
    </StaffShell>
  );
}
