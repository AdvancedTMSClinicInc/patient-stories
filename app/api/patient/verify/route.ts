import { mutate } from "@/lib/db";
import { verifyInvite } from "@/lib/invites";
import { startPatientSession } from "@/lib/session";
import { fail, handle, json, readJson } from "@/lib/http";

export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson<{ token?: unknown; code?: unknown }>(req);
    const token = typeof body.token === "string" ? body.token : "";
    const code = typeof body.code === "string" ? body.code : "";
    if (!token || !/^\d{6}$/.test(code)) return fail("Enter the 6-digit code.");
    const outcome = mutate((db) => verifyInvite(db, token, code));
    if (!outcome.ok) {
      switch (outcome.reason) {
        case "WRONG_CODE":
          return fail(`That code doesn't match. ${outcome.attemptsLeft} ${outcome.attemptsLeft === 1 ? "try" : "tries"} left.`, 401);
        case "LOCKED":
          return fail("This link is locked after too many tries. Text (855) ILUV-TMS for a new one.", 423);
        case "EXPIRED":
          return fail("This link has expired. Text (855) ILUV-TMS for a new one.", 410);
        default:
          return fail("This link isn't valid. Please check the link your clinic sent.", 404);
      }
    }
    await startPatientSession(outcome.invitation.id);
    return json({ ok: true });
  });
}
