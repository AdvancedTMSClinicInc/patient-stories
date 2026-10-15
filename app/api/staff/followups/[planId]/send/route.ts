import { mutate } from "@/lib/db";
import { DomainError } from "@/lib/domain";
import { sendFollowUp } from "@/lib/ghl";
import { followUpDates } from "@/lib/protocols";
import { inScope } from "@/lib/rbac";
import { addDays, todayStr } from "@/lib/dates";
import { handle, json, readJson, staffOr401 } from "@/lib/http";

export async function POST(req: Request, { params }: { params: Promise<{ planId: string }> }) {
  return handle(async () => {
    const staff = await staffOr401("followups.manage");
    if (staff instanceof Response) return staff;
    const { planId } = await params;
    const { dueOn } = await readJson<{ dueOn?: string }>(req);
    const log = mutate((db) => {
      const plan = db.treatmentPlans.find((p) => p.id === planId);
      if (!plan || !inScope(staff, plan.facilityId)) throw new DomainError("Plan not found.", 404);
      if (!dueOn || !followUpDates(plan, addDays(todayStr(), 7)).includes(dueOn)) throw new DomainError("No follow-up is due for that date.");
      if (db.reminders.some((r) => r.treatmentPlanId === plan.id && r.dueOn === dueOn)) throw new DomainError("Already sent.", 409);
      const patient = db.patients.find((p) => p.id === plan.patientId)!;
      if (!patient.phone) throw new DomainError("No mobile number on file.");
      return sendFollowUp(db, plan, patient, dueOn, staff.id);
    });
    return json({ ok: true, via: log.via });
  });
}
