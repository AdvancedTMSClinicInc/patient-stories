import { mutate } from "@/lib/db";
import { decideTestimonial, DomainError } from "@/lib/domain";
import { inScope } from "@/lib/rbac";
import { handle, json, readJson, staffOr401 } from "@/lib/http";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const staff = await staffOr401("testimonials.decide");
    if (staff instanceof Response) return staff;
    const { id } = await params;
    const b = await readJson<{ decision?: string; reason?: string }>(req);
    if (b.decision !== "APPROVE" && b.decision !== "REJECT") throw new DomainError("Choose approve or reject.");
    const decision = b.decision;
    const t = mutate((db) => {
      const found = db.testimonials.find((x) => x.id === id);
      if (!found || !inScope(staff, found.facilityId)) throw new DomainError("Video not found.", 404);
      return decideTestimonial(db, id, decision, typeof b.reason === "string" ? b.reason : "", staff.id);
    });
    return json({ ok: true, status: t.status });
  });
}
