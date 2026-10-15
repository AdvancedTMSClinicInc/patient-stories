import fs from "node:fs";
import { Readable } from "node:stream";

/**
 * Streams a private file with HTTP Range support (Safari needs it to play video).
 * Responses are never cached by browsers or proxies.
 */
export function serveFile(req: Request, filePath: string, mimeType: string, downloadName?: string): Response {
  const size = fs.statSync(filePath).size;
  const headers: Record<string, string> = {
    "Content-Type": mimeType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (downloadName) headers["Content-Disposition"] = `attachment; filename="${downloadName.replace(/[^A-Za-z0-9._-]/g, "_")}"`;

  const range = req.headers.get("range");
  const m = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
  if (m && !downloadName) {
    let start = m[1] === "" ? NaN : Number(m[1]);
    let end = m[2] === "" ? NaN : Number(m[2]);
    if (Number.isNaN(start)) {
      // suffix range: last N bytes
      start = Math.max(0, size - (Number.isNaN(end) ? 0 : end));
      end = size - 1;
    } else if (Number.isNaN(end) || end >= size) {
      end = size - 1;
    }
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    const stream = fs.createReadStream(filePath, { start, end });
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }
  const stream = fs.createReadStream(filePath);
  return new Response(Readable.toWeb(stream) as ReadableStream, { status: 200, headers: { ...headers, "Content-Length": String(size) } });
}
