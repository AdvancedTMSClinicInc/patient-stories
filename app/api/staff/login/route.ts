import { mutate, readDb } from "@/lib/db";
import { appendAudit } from "@/lib/audit";
import { startStaffSession } from "@/lib/session";
import { sampleLoginAllowed } from "@/lib/flags";
import { homeFor } from "@/lib/staffnav";
import { fail, handle, json, readJson } from "@/lib/http";

export async function POST(req: Request) {
  return handle(async () => {
    if (!sampleLoginAllowed()) return fail("Sample sign-in is turned off.", 403);
    const { staffId } = await readJson<{ staffId?: string }>(req);
    const staff = readDb().staff.find((s) => s.id === staffId && !s.disabled);
    if (!staff) return fail("Unknown account.", 404);
    await startStaffSession(staff.id);
    mutate((db) => appendAudit(db, { actorType: "STAFF", actorId: staff.id, action: "STAFF_SIGNED_IN", entity: "staff", entityId: staff.id, detail: { method: "sample" } }));
    return json({ ok: true, home: homeFor(staff) });
  });
}
