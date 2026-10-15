# Patient Stories — notes for Claude Code

Patient testimonial, treatment journal and staff review app for Advanced TMS Clinic Inc and Pacific Health Systems LP. Next.js 15 (App Router) + TypeScript. Prototype stage.

## Ground rules (do not break)
- **Sample data only.** Never add real patient names, phone numbers, videos or other PHI to code, tests, seed data or commits.
- **Never claim HIPAA compliance** in UI copy, docs or commit messages. Say "built on HIPAA-eligible services" only after BAAs are signed and the security/legal review is done.
- **Ask before** deploying, creating cloud resources, buying domains, or connecting any outside service (AWS, GoHighLevel, email/SMS, Google). These are approval gates in the project plan.
- Marketing and clinical data stay separate: journal entries and check-in videos must never be viewable or exportable by marketing roles (see `lib/rbac.ts`).
- A testimonial can only be approved or exported while its authorization is ACTIVE and unexpired (`lib/domain.ts`). Keep the tests for this passing.
- The Google review link is shown to every patient the same way. Never add logic that shows it only to satisfied patients (review gating).
- Follow-up texts stay generic: no diagnosis or treatment named.
- No analytics, tracking pixels or third-party scripts on patient pages.

## Where things are
- `lib/protocols.ts` — treatment timelines, check-ins, 12-week follow-ups, Spravato 2-hour monitoring window
- `lib/domain.ts` — authorizations, revocation + takedown, testimonials, journal, crisis flagging
- `lib/db.ts` — prototype JSON store (swap for PostgreSQL in Phase 2; keep reads/writes going through it)
- `lib/storage.ts` — prototype local file storage (swap for private S3)
- `lib/ghl.ts` — GoHighLevel, test mode only
- `lib/session.ts` — patient (invite + code) and staff (sample login → SSO later) sessions
- `app/p/*` patient screens, `app/staff/*` staff dashboard, `app/api/*` endpoints

## Checks
- `npm test` — unit tests (must pass)
- `npm run build` — includes type checking
- `node tests/smoke.mjs` after a build — end-to-end patient and staff flows
- GitHub Actions runs all three on every push.
