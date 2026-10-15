import { mutate } from "@/lib/db";
import { newId } from "@/lib/crypto";
import { storeVideoUpload } from "@/lib/upload";
import { handle, json, patientOr401 } from "@/lib/http";
import { DomainError } from "@/lib/domain";
import { inSpravatoMonitoringWindow } from "@/lib/protocols";

// Private check-in videos for the patient's journal. These are never part of
// a testimonial and can't be exported for marketing.
export async function POST(req: Request) {
  return handle(async () => {
    const ctx = await patientOr401();
    if (ctx instanceof Response) return ctx;
    if (ctx.invitation.purpose === "TESTIMONIAL") throw new DomainError("This invitation doesn't include the journal.", 403);
    if (inSpravatoMonitoringWindow(ctx.plan)) throw new DomainError("Please rest today. You can record tomorrow.", 409);
    const video = await storeVideoUpload(req, "journal");
    const media = mutate((db) => {
      const m = { id: newId(), patientId: ctx.patient.id, ...video, createdAt: new Date().toISOString(), attachedToEntryId: null };
      db.media.push(m);
      return m;
    });
    return json({ ok: true, mediaId: media.id });
  });
}
