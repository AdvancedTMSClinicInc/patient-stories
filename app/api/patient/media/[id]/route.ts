import { readDb } from "@/lib/db";
import { objectPath } from "@/lib/storage";
import { serveFile } from "@/lib/stream";
import { fail, patientOr401 } from "@/lib/http";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await patientOr401();
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  const media = readDb().media.find((m) => m.id === id && m.patientId === ctx.patient.id);
  const file = media ? objectPath(media.objectKey) : null;
  if (!media || !file) return fail("Not found.", 404);
  return serveFile(req, file, media.mimeType);
}
