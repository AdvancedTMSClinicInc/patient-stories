import { requireStaff } from "@/lib/session";
import { readDb } from "@/lib/db";
import { inScope } from "@/lib/rbac";
import { followUpDates, nextFollowUpDate, plannedSessionDates } from "@/lib/protocols";
import { followUpMessage, ghlMode, maskPhone } from "@/lib/ghl";
import { PROTOCOL_LABELS } from "@/lib/types";
import { addDays, fmtDateTime, fmtDay, todayStr } from "@/lib/dates";
import StaffShell, { FacilityBadge } from "@/components/StaffShell";
import ActionButton from "@/components/ActionButton";

export const dynamic = "force-dynamic";

export default async function FollowUps() {
  const staff = await requireStaff("followups.manage");
  const db = readDb();
  const today = todayStr();
  const horizon = addDays(today, 7);
  const plans = db.treatmentPlans.filter((p) => inScope(staff, p.facilityId));

  const due: { planId: string; dueOn: string }[] = [];
  const upcoming: { planId: string; dueOn: string }[] = [];
  for (const plan of plans) {
    const total = plannedSessionDates(plan.protocol, plan.startDate).length;
    const finished = plan.protocol === "SPRAVATO" || total === 0 || plan.sessionsCompleted >= total;
    const sent = new Set(db.reminders.filter((r) => r.treatmentPlanId === plan.id).map((r) => r.dueOn));
    const pending = finished ? followUpDates(plan, horizon).filter((d) => !sent.has(d)) : [];
    if (pending.length) due.push({ planId: plan.id, dueOn: pending[pending.length - 1] });
    else upcoming.push({ planId: plan.id, dueOn: nextFollowUpDate(plan, addDays(horizon, 1)) });
  }
  const log = db.reminders.filter((r) => plans.some((p) => p.id === r.treatmentPlanId)).sort((a, b) => b.sentAt.localeCompare(a.sentAt)).slice(0, 30);
  const row = (planId: string) => {
    const plan = plans.find((p) => p.id === planId)!;
    const patient = db.patients.find((x) => x.id === plan.patientId)!;
    const f = db.facilities.find((x) => x.id === plan.facilityId)!;
    const l = db.locations.find((x) => x.id === plan.locationId);
    return { plan, patient, f, l };
  };

  return (
    <StaffShell user={staff} active="/staff/followups">
      <div className="s-head">
        <div>
          <h1>12-week follow-ups</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            A short text from (855) ILUV-TMS asking how the patient feels. Replies go to your GoHighLevel inbox like any other patient text.
          </p>
        </div>
        <span className="badge warn">{ghlMode() === "mock" ? "GoHighLevel: test mode (nothing is sent)" : "GoHighLevel: live"}</span>
      </div>

      <h2 className="eyebrow">Due now or this week</h2>
      <div className="table-box">
        <table className="s-table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Plan</th>
              <th>Due</th>
              <th>Phone</th>
              <th>Text that will be sent</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {due.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  Nothing due this week.
                </td>
              </tr>
            ) : (
              due.map(({ planId, dueOn }) => {
                const { plan, patient, f, l } = row(planId);
                return (
                  <tr key={planId}>
                    <td>
                      {patient.firstName} {patient.lastName}
                      <br />
                      <FacilityBadge code={f.code} name={`${f.name} · ${l?.name ?? ""}`} />
                    </td>
                    <td>{PROTOCOL_LABELS[plan.protocol]}</td>
                    <td>{fmtDay(dueOn)}</td>
                    <td>{maskPhone(patient.phone)}</td>
                    <td className="small" style={{ maxWidth: 340 }}>
                      {followUpMessage(patient, plan)}
                    </td>
                    <td>
                      <ActionButton url={`/api/staff/followups/${plan.id}/send`} body={{ dueOn }} className="btn btn-small btn-gold" label="Send text" busyLabel="Sending…" />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <h2 className="eyebrow" style={{ marginTop: 8 }}>
        Coming up
      </h2>
      <div className="table-box">
        <table className="s-table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Plan</th>
              <th>Next follow-up (about)</th>
            </tr>
          </thead>
          <tbody>
            {upcoming
              .sort((a, b) => a.dueOn.localeCompare(b.dueOn))
              .map(({ planId, dueOn }) => {
                const { plan, patient, f } = row(planId);
                return (
                  <tr key={planId}>
                    <td>
                      {patient.firstName} {patient.lastName} <FacilityBadge code={f.code} name={f.name} />
                    </td>
                    <td>{PROTOCOL_LABELS[plan.protocol]}</td>
                    <td>{fmtDay(dueOn)}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <h2 className="eyebrow" style={{ marginTop: 8 }}>
        Sent
      </h2>
      {log.length === 0 ? <p className="muted small" style={{ margin: 0 }}>No follow-up texts yet.</p> : null}
      {log.map((r) => {
        const p = db.patients.find((x) => x.id === r.patientId);
        return (
          <article key={r.id} className="card" style={{ gap: 4 }}>
            <div className="row small muted">
              <span>
                To {p?.firstName} {p?.lastName} ({r.toPhoneMasked}) · {fmtDateTime(r.sentAt)}
              </span>
              <span className="spacer" />
              <span className="badge">{r.via === "GHL_MOCK" ? "Test mode: not sent" : "Sent via GoHighLevel"}</span>
            </div>
            <p style={{ margin: 0 }}>{r.message}</p>
          </article>
        );
      })}
    </StaffShell>
  );
}
