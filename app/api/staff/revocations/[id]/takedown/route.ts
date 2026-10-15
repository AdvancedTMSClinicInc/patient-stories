import { mutate } from "@/lib/db";
import { markTakedown, DomainError, ALL_CHANNELS } from "@/lib/domain";
import { inScope } from "@/lib/rbac";
import { handle, json, readJson, staffOr401 } from "@/lib/http";
import type { Channel } from "@/lib/types";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const staff = await staffOr401("authorizations.manage");
    if (staff instanceof Response) return staff;
    const { id } = await params;
    const b = await readJson<{ channel?: string; done?: boolean }>(req);
    if (!b.channel || !ALL_CHANNELS.includes(b.channel as Channel)) throw new DomainError("Unknown channel.");
    const channel = b.channel as Channel;
    mutate((db) => {
      const r = db.revocations.find((x) => x.id === id);
      const a = r ? db.authorizations.find((x) => x.id === r.authorizationId) : undefined;
      if (!r || !a || !inScope(staff, a.facilityId)) throw new DomainError("Not found.", 404);
      markTakedown(db, id, channel, staff.id, b.done !== false);
    });
    return json({ ok: true });
  });
}
