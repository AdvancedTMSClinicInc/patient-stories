import crypto from "node:crypto";

export function newId(): string {
  return crypto.randomUUID();
}

/** URL-safe random token (default 32 bytes = 256 bits). */
export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

/** Six-digit numeric code, uniformly random. */
export function sixDigitCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function sha256(input: string | Buffer): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/** Constant-time comparison of two hex digests. */
export function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ab.length !== bb.length || ab.length === 0) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/** Hash an IP address with a server secret so logs never hold raw IPs. */
export function hashIp(ip: string | null | undefined): string {
  const secret = process.env.APP_SECRET ?? "dev-only-secret-change-me";
  return sha256(`${secret}:${ip ?? "unknown"}`).slice(0, 24);
}
