import { mutate } from "@/lib/db";
import { createTestimonial, DomainError } from "@/lib/domain";
import { storeVideoUpload } from "@/lib/upload";
import { deleteObject } from "@/lib/storage";
import { inSpravatoMonitoringWindow } from "@/lib/protocols";
import { handle, json, patientOr401 } from "@/lib/http";

export async function POST(req: Request) {
  return handle(async () => {
    const ctx = await patientOr401();
    if (ctx instanceof Response) return ctx;
    if (ctx.invitation.purpose === "JOURNAL") throw new DomainError("This invitation is for the journal only.", 403);
    if (!ctx.authorization) throw new DomainError("Please sign the permission form first.", 403);
    if (inSpravatoMonitoringWindow(ctx.plan)) throw new DomainError("Please rest today. You can record tomorrow.", 409);
    const video = await storeVideoUpload(req, "testimonials");
    try {
      const t = mutate((db) => {
        const inv = db.invitations.find((i) => i.id === ctx.invitation.id)!;
        return createTestimonial(db, inv, video);
      });
      return json({ ok: true, id: t.id });
    } catch (e) {
      deleteObject(video.objectKey);
      throw e;
    }
  });
}
