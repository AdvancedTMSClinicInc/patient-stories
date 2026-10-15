import { mutate } from "@/lib/db";
import { appendAudit } from "@/lib/audit";
import { DomainError } from "@/lib/domain";
import { plannedSessionDates } from "@/lib/protocols";
import { inScope } from "@/lib/rbac";
import { handle, json, readJson, staffOr401 } from "@/lib/http";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const staff = await staffOr401("plans.manage");
    if (staff instanceof Response) return staff;
    const { id } = await params;
    const { delta } = await readJson<{ delta?: number }>(req);
    if (delta !== 1 && delta !== -1) throw new DomainError("Invalid change.");
    const plan = mutate((db) => {
      const p = db.treatmentPlans.find((x) => x.id === id);
      if (!p || !inScope(staff, p.facilityId)) throw new DomainError("Plan not found.", 404);
      const planned = plannedSessionDates(p.protocol, p.startDate).length;
      // Spravato maintenance continues past the 12 planned induction/weekly sessions.
      const max = p.protocol === "SPRAVATO" ? 999 : planned;
      p.sessionsCompleted = Math.min(max, Math.max(0, p.sessionsCompleted + delta));
      if (delta === 1) p.lastSessionAt = new Date().toISOString();
      appendAudit(db, {
        actorType: "STAFF",
        actorId: staff.id,
        action: delta === 1 ? "SESSION_MARKED_COMPLETE" : "SESSION_UNMARKED",
        entity: "treatment_plan",
        entityId: p.id,
        facilityId: p.facilityId,
        detail: { sessionsCompleted: p.sessionsCompleted },
      });
      return p;
    });
    return json({ ok: true, sessionsCompleted: plan.sessionsCompleted });
  });
}
