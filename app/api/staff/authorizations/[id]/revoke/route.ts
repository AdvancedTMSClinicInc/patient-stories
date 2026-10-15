import { mutate } from "@/lib/db";
import { revokeAuthorization, DomainError } from "@/lib/domain";
import { inScope } from "@/lib/rbac";
import { handle, json, readJson, staffOr401 } from "@/lib/http";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const staff = await staffOr401("authorizations.manage");
    if (staff instanceof Response) return staff;
    const { id } = await params;
    const { via } = await readJson<{ via?: string }>(req);
    if (via !== "PHONE" && via !== "EMAIL" && via !== "MAIL") throw new DomainError("Choose how the request arrived.");
    mutate((db) => {
      const a = db.authorizations.find((x) => x.id === id);
      if (!a || !inScope(staff, a.facilityId)) throw new DomainError("Authorization not found.", 404);
      revokeAuthorization(db, id, via, { type: "STAFF", id: staff.id });
    });
    return json({ ok: true });
  });
}
