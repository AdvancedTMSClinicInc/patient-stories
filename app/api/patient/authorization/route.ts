import { mutate } from "@/lib/db";
import { signAuthorization, DomainError, type SignInput } from "@/lib/domain";
import { inSpravatoMonitoringWindow } from "@/lib/protocols";
import { clientIpHash } from "@/lib/session";
import { handle, json, patientOr401, readJson } from "@/lib/http";
import type { Channel, NameDisplay } from "@/lib/types";

export async function POST(req: Request) {
  return handle(async () => {
    const ctx = await patientOr401();
    if (ctx instanceof Response) return ctx;
    if (ctx.invitation.purpose === "JOURNAL") throw new DomainError("This invitation is for the journal only.", 403);
    if (inSpravatoMonitoringWindow(ctx.plan)) throw new DomainError("Please rest today. You can sign tomorrow.", 409);
    const body = await readJson<Record<string, unknown>>(req);
    const input: SignInput = {
      channels: Array.isArray(body.channels) ? (body.channels.filter((c) => typeof c === "string") as Channel[]) : [],
      nameDisplay: String(body.nameDisplay) as NameDisplay,
      blurFace: body.blurFace === true,
      signedName: typeof body.signedName === "string" ? body.signedName : "",
      years: Number(body.years) || 3,
      agreed: body.agreed === true,
    };
    const ip = await clientIpHash();
    const auth = mutate((db) => {
      const inv = db.invitations.find((i) => i.id === ctx.invitation.id)!;
      return signAuthorization(db, inv, input, ip);
    });
    return json({ ok: true, id: auth.id, expiresOn: auth.expiresOn });
  });
}
