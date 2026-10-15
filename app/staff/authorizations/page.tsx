import { requireStaff } from "@/lib/session";
import { readDb } from "@/lib/db";
import { inScope } from "@/lib/rbac";
import { refreshAuthorizationStatus } from "@/lib/domain";
import { CHANNEL_LABELS } from "@/lib/types";
import { fmtDateTime, fmtDayYear } from "@/lib/dates";
import StaffShell, { FacilityBadge, StatusBadge } from "@/components/StaffShell";
import ActionButton from "@/components/ActionButton";
import StaffRevokeForm from "@/components/StaffRevokeForm";

export const dynamic = "force-dynamic";

export default async function Authorizations() {
  const staff = await requireStaff("authorizations.manage");
  const db = readDb();
  refreshAuthorizationStatus(db);
  const auths = db.authorizations.filter((a) => inScope(staff, a.facilityId)).sort((a, b) => b.signedAt.localeCompare(a.signedAt));
  const revs = db.revocations
    .filter((r) => auths.some((a) => a.id === r.authorizationId))
    .sort((a, b) => Number(!!a.confirmedAt) - Number(!!b.confirmedAt) || b.receivedAt.localeCompare(a.receivedAt));
  const who = (id: string) => db.patients.find((p) => p.id === id);

  return (
    <StaffShell user={staff} active="/staff/authorizations">
      <div className="s-head">
        <div>
          <h1>Authorizations</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            Signed marketing permissions, revocations, and the takedown checklist for each revoked video.
          </p>
        </div>
      </div>

      <h2 className="eyebrow">Revocations and takedowns</h2>
      {revs.length === 0 ? <p className="muted small" style={{ margin: 0 }}>No revocations.</p> : null}
      {revs.map((r) => {
        const a = db.authorizations.find((x) => x.id === r.authorizationId)!;
        const p = who(a.patientId);
        const f = db.facilities.find((x) => x.id === a.facilityId)!;
        return (
          <section key={r.id} className="card">
            <div className="row">
              <strong>
                {p?.firstName} {p?.lastName}
              </strong>
              <FacilityBadge code={f.code} name={f.name} />
              <span className="small muted">
                Revoked by {r.requestedVia === "APP" ? "the patient in the app" : `${r.requestedVia.toLowerCase()} request`} · {fmtDateTime(r.receivedAt)}
              </span>
              <span className="spacer" />
              {r.confirmedAt ? <span className="badge good">Takedown complete</span> : <span className="badge warn">Takedown open</span>}
            </div>
            <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0, gap: 6 }}>
              {r.takedown.map((t) => (
                <li key={t.channel} className="row">
                  <span>{CHANNEL_LABELS[t.channel]}</span>
                  <span className="spacer" />
                  {t.done ? <span className="small muted">Removed {t.doneAt ? fmtDateTime(t.doneAt) : ""}</span> : null}
                  <ActionButton
                    url={`/api/staff/revocations/${r.id}/takedown`}
                    body={{ channel: t.channel, done: !t.done }}
                    className={`btn btn-small ${t.done ? "btn-outline" : "btn-navy"}`}
                    label={t.done ? "Undo" : "Mark removed"}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <h2 className="eyebrow" style={{ marginTop: 8 }}>
        All authorizations
      </h2>
      <div className="table-box">
        <table className="s-table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Channels</th>
              <th>Signed</th>
              <th>Expires</th>
              <th>Status</th>
              <th>Log a revocation</th>
            </tr>
          </thead>
          <tbody>
            {auths.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  No signed authorizations yet.
                </td>
              </tr>
            ) : (
              auths.map((a) => {
                const p = who(a.patientId);
                const f = db.facilities.find((x) => x.id === a.facilityId)!;
                return (
                  <tr key={a.id}>
                    <td>
                      {p?.firstName} {p?.lastName}
                      <br />
                      <FacilityBadge code={f.code} name={f.name} />
                    </td>
                    <td className="small">{a.channels.map((c) => CHANNEL_LABELS[c]).join(", ")}</td>
                    <td>{fmtDateTime(a.signedAt)}</td>
                    <td>{fmtDayYear(a.expiresOn)}</td>
                    <td>
                      <StatusBadge status={a.status} />
                    </td>
                    <td>{a.status === "ACTIVE" ? <StaffRevokeForm authorizationId={a.id} /> : null}</td>
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
