import { mutate } from "@/lib/db";
import { addJournalEntry, DomainError } from "@/lib/domain";
import { handle, json, patientOr401, readJson } from "@/lib/http";

export async function POST(req: Request) {
  return handle(async () => {
    const ctx = await patientOr401();
    if (ctx instanceof Response) return ctx;
    if (ctx.invitation.purpose === "TESTIMONIAL") throw new DomainError("This invitation doesn't include the journal.", 403);
    const b = await readJson<Record<string, unknown>>(req);
    const milestone = typeof b.milestone === "string" && /^[A-Z0-9_]{2,20}$/.test(b.milestone) ? b.milestone : null;
    const entry = mutate((db) =>
      addJournalEntry(db, ctx.patient.id, ctx.plan?.id ?? null, {
        body: typeof b.body === "string" ? b.body : "",
        mood: Number(b.mood),
        sleep: Number(b.sleep),
        energy: Number(b.energy),
        milestone,
        mediaId: typeof b.mediaId === "string" ? b.mediaId : null,
        sharedWithCareTeam: b.sharedWithCareTeam === true,
      }),
    );
    return json({ ok: true, id: entry.id, flagged: entry.flagged });
  });
}
