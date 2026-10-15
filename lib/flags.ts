/**
 * Sample staff sign-in is a prototype convenience. It is on for local
 * development, and on a test server only when ALLOW_SAMPLE_LOGIN=1.
 * It must be off (and replaced by SSO) before any real patient data.
 */
export function sampleLoginAllowed(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_SAMPLE_LOGIN === "1";
}
