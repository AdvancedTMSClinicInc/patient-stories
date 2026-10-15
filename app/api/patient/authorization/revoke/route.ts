import { mutate } from "@/lib/db";
import { revokeAuthorization, DomainError } from "@/lib/domain";
import { handle, json, patientOr401, readJson } from "@/lib/http";

export async function POST(req: Request) {
  return handle(async () => {
    const ctx = await patientOr401();
    if (ctx instanceof Response) return ctx;
    const { authorizationId } = await readJson<{ authorizationId?: string }>(req);
    mutate((db) => {
      const auth = db.authorizations.find((a) => a.id === authorizationId);
      if (!auth || auth.patientId !== ctx.patient.id) throw new DomainError("Permission not found.", 404);
      revokeAuthorization(db, auth.id, "APP", { type: "PATIENT", id: ctx.patient.id });
    });
    return json({ ok: true });
  });
}
