import { requireStaff } from "@/lib/session";
import { readDb } from "@/lib/db";
import { inScope } from "@/lib/rbac";
import { verifyAuditChain } from "@/lib/audit";
import { fmtDateTime } from "@/lib/dates";
import StaffShell from "@/components/StaffShell";

export const dynamic = "force-dynamic";

export default async function Audit() {
  const staff = await requireStaff("audit.view");
  const db = readDb();
  const broken = verifyAuditChain(db.audit);
  const rows = db.audit.filter((e) => inScope(staff, e.facilityId)).slice(-300).reverse();
  const actor = (type: string, id: string) => {
    if (type === "STAFF") return db.staff.find((s) => s.id === id)?.name ?? id;
    if (type === "PATIENT") {
      const p = db.patients.find((x) => x.id === id);
      return p ? `Patient ${p.firstName} ${p.lastName.charAt(0)}.` : "Patient";
    }
    return "System";
  };
  return (
    <StaffShell user={staff} active="/staff/audit">
      <div className="s-head">
        <div>
          <h1>Audit log</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            Every sign-in, view, decision, export, revocation and message. Each entry is chained to the one before it, so any edit is detectable.
          </p>
        </div>
        {broken === -1 ? (
          <span className="badge good">Chain verified · {db.audit.length} entries</span>
        ) : (
          <span className="badge bad">Chain broken at entry {broken + 1}</span>
        )}
      </div>
      <div className="table-box">
        <table className="s-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>Action</th>
              <th>Record</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id}>
                <td style={{ whiteSpace: "nowrap" }}>{fmtDateTime(e.at)}</td>
                <td>{actor(e.actorType, e.actorId)}</td>
                <td>{e.action.toLowerCase().replace(/_/g, " ")}</td>
                <td className="mono">
                  {e.entity} {e.entityId.slice(0, 8)}
                </td>
                <td className="mono">{Object.keys(e.detail).length ? JSON.stringify(e.detail).slice(0, 140) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </StaffShell>
  );
}
