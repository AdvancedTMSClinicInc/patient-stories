import { readDb } from "@/lib/db";
import { inScope } from "@/lib/rbac";
import { objectPath } from "@/lib/storage";
import { serveFile } from "@/lib/stream";
import { fail, staffOr401 } from "@/lib/http";

// Streams a submitted testimonial to authorized staff. Viewing is audit-logged
// on the detail page; this endpoint is hit repeatedly by the player (range requests).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await staffOr401("testimonials.view");
  if (staff instanceof Response) return staff;
  const { id } = await params;
  const t = readDb().testimonials.find((x) => x.id === id);
  if (!t || !inScope(staff, t.facilityId)) return fail("Not found.", 404);
  const file = objectPath(t.objectKey);
  if (!file) return fail("Video file missing.", 404);
  return serveFile(req, file, t.mimeType);
}
