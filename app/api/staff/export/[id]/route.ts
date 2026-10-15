import { mutate, readDb } from "@/lib/db";
import { appendAudit } from "@/lib/audit";
import { assertExportable, DomainError } from "@/lib/domain";
import { inScope } from "@/lib/rbac";
import { objectPath, extensionFor } from "@/lib/storage";
import { serveFile } from "@/lib/stream";
import { handle, staffOr401 } from "@/lib/http";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const staff = await staffOr401("testimonials.export");
    if (staff instanceof Response) return staff;
    const { id } = await params;
    const t = mutate((db) => {
      const found = db.testimonials.find((x) => x.id === id);
      if (!found || !inScope(staff, found.facilityId)) throw new DomainError("Video not found.", 404);
      const ok = assertExportable(db, id);
      appendAudit(db, { actorType: "STAFF", actorId: staff.id, action: "TESTIMONIAL_EXPORTED", entity: "testimonial", entityId: ok.id, facilityId: ok.facilityId });
      return ok;
    });
    const file = objectPath(t.objectKey);
    if (!file) throw new DomainError("Video file missing.", 404);
    const p = readDb().patients.find((x) => x.id === t.patientId);
    const name = `approved-${p?.firstName ?? "patient"}-${t.submittedAt.slice(0, 10)}.${extensionFor(t.mimeType)}`;
    return serveFile(req, file, t.mimeType, name);
  });
}
