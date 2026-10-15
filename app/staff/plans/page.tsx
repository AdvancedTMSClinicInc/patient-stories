import { requireStaff } from "@/lib/session";
import { readDb } from "@/lib/db";
import { inScope } from "@/lib/rbac";
import { buildTimeline, inSpravatoMonitoringWindow } from "@/lib/protocols";
import { PROTOCOL_LABELS } from "@/lib/types";
import { fmtDay, todayStr } from "@/lib/dates";
import StaffShell, { FacilityBadge } from "@/components/StaffShell";
import ActionButton from "@/components/ActionButton";

export const dynamic = "force-dynamic";

export default async function Plans() {
  const staff = await requireStaff("plans.manage");
  const db = readDb();
  const today = todayStr();
  const plans = db.treatmentPlans.filter((p) => inScope(staff, p.facilityId)).sort((a, b) => b.startDate.localeCompare(a.startDate));
  return (
    <StaffShell user={staff} active="/staff/plans">
      <div className="s-head">
        <div>
          <h1>Treatment plans</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            Mark sessions as they happen. This moves the patient's &quot;you are here&quot; marker and sets their check-in and follow-up dates.
            Logging a Spravato session pauses recording prompts for that patient for 2 hours.
          </p>
        </div>
      </div>
      <div className="table-box">
        <table className="s-table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Plan</th>
              <th>Started</th>
              <th>Progress</th>
              <th>Next check-in</th>
              <th>Sessions</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => {
              const p = db.patients.find((x) => x.id === plan.patientId);
              const f = db.facilities.find((x) => x.id === plan.facilityId)!;
              const l = db.locations.find((x) => x.id === plan.locationId);
              const recorded = new Set(db.journalEntries.filter((e) => e.patientId === plan.patientId && e.milestone).map((e) => e.milestone as string));
              const t = buildTimeline(plan, today, recorded);
              const total = t.totalSessions;
              return (
                <tr key={plan.id}>
                  <td>
                    {p?.firstName} {p?.lastName}
                    <br />
                    <FacilityBadge code={f.code} name={`${f.name} · ${l?.name ?? ""}`} />
                  </td>
                  <td>{PROTOCOL_LABELS[plan.protocol]}</td>
                  <td>{fmtDay(plan.startDate)}</td>
                  <td>
                    {t.summary}
                    {inSpravatoMonitoringWindow(plan) ? (
                      <>
                        <br />
                        <span className="badge warn">In 2-hour monitoring</span>
                      </>
                    ) : null}
                  </td>
                  <td>{t.nextCheckin ? `${t.nextCheckin.label} · ${fmtDay(t.nextCheckin.dueOn)}` : "All recorded"}</td>
                  <td>
                    {total ? (
                      <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                        <ActionButton url={`/api/staff/plans/${plan.id}/session`} body={{ delta: -1 }} className="btn btn-small btn-outline" label="−1" />
                        <span style={{ minWidth: 56, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
                          {plan.sessionsCompleted}
                          {plan.protocol === "SPRAVATO" && plan.sessionsCompleted >= total ? "" : ` / ${total}`}
                        </span>
                        <ActionButton url={`/api/staff/plans/${plan.id}/session`} body={{ delta: 1 }} className="btn btn-small btn-navy" label="+1" />
                      </div>
                    ) : (
                      <span className="small muted">Visits not tracked</span>
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
