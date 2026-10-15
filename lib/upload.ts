import { sha256, newId } from "./crypto";
import { putObject, extensionFor, MAX_UPLOAD_BYTES } from "./storage";
import { DomainError, MAX_SECONDS } from "./domain";
import type { StoredVideo } from "./domain";

const ALLOWED = ["video/webm", "video/mp4", "video/quicktime"];

/**
 * Reads a raw video upload, checks type and size, and stores it privately.
 * Phase 2: upload straight to S3 with a short-lived signed URL, then transcode
 * in an isolated worker and verify the container before anyone can view it.
 */
export async function storeVideoUpload(req: Request, folder: "testimonials" | "journal"): Promise<StoredVideo> {
  const type = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!ALLOWED.includes(type)) throw new DomainError("Unsupported video format.", 415);
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_UPLOAD_BYTES) throw new DomainError("This video is too large.", 413);
  const duration = Number(req.headers.get("x-duration-seconds") ?? "0");
  if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_SECONDS + 5) throw new DomainError("Videos must be 2 minutes or shorter.");
  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length === 0) throw new DomainError("The video was empty. Please record again.");
  if (buf.length > MAX_UPLOAD_BYTES) throw new DomainError("This video is too large.", 413);
  if (!looksLikeVideo(buf)) throw new DomainError("That file doesn't look like a video.", 415);
  const key = `${folder}/${newId()}.${extensionFor(type)}`;
  putObject(key, buf);
  return { objectKey: key, mimeType: type, sizeBytes: buf.length, sha256: sha256(buf), durationS: Math.round(duration) };
}

/** Checks the first bytes for a WebM (EBML) or MP4/QuickTime ("ftyp") header. */
export function looksLikeVideo(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  const ebml = buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3;
  const ftyp = buf.subarray(4, 8).toString("latin1") === "ftyp";
  return ebml || ftyp;
}
