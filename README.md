# Patient Stories

Private video stories, treatment journal and staff review for **Advanced TMS Clinic Inc** and **Pacific Health Systems LP**.

> **Prototype — sample data only.** Do not enter real patient information. This app is not HIPAA compliant and must not be described that way. Real patients only after the security and legal review in the plan (Gate 4).

## Try it on your computer

You need **Node.js 20 or newer** (download the "LTS" version from nodejs.org).

```bash
git clone https://github.com/AdvancedTMSClinicInc/patient-stories.git
cd patient-stories
npm install
npm run dev
```

Open **http://localhost:3000** in Chrome, Edge or Safari.

1. **As a patient:** click *Sample patient links*, open one, and type its 6-digit code. Six made-up patients cover every treatment plan (standard TMS, accelerated, One-Day, Spravato, therapy, and one finished patient whose 12-week follow-up is due).
2. **As staff:** click *Staff sign in* and pick a sample account. Each role sees different pages (marketing can't see journals; clinic staff can't approve marketing videos).

Recording uses your computer's webcam. On `localhost` the browser allows camera access without https.

**Shorter test videos:** the minimum is 60 seconds. To test faster, start with
`TESTIMONIAL_MIN_SECONDS=10 npm run dev`.

**Start over:** stop the app and run `npm run reset-data`. All sample data, including test videos, lives in the `data/` folder, which is never committed to git.

### Testing on a phone

Phones only allow the camera on secure (https) sites, so a phone can't record from `http://your-computer:3000`. Phone testing happens on the test server in Phase 2 (needs your approval: AWS account under its BAA, test domain).

## What's in it

**Patients** (mobile-first, branded per facility)
- Invite link + separate 6-digit code; locks after 5 wrong codes; expires (7 days for video-only invites, 180 days with the journal)
- Separate marketing authorization: channels, name display, face blur, 1–3 year expiry, typed signature, form version kept; view, print, revoke anytime
- Recorder: guided prompts, 60–120 s timer, pause, switch camera, preview, up to 5 takes, upload with progress
- Thank-you page with the location's Google review link, shown to everyone the same way (no review gating)
- Journal: mood / sleep / energy (0–10), notes, optional private video, mood chart, share-with-care-team option
- Treatment timeline with milestone video check-ins for each plan, patience reminders for One-Day TMS
- Spravato: no recording prompts or signatures within 2 hours of a logged dose
- Crisis language shows 988 to the patient and alerts clinical staff

**Staff**
- Review queue (filter by facility, location, service, status), video review, approve / reject with reason, download approved videos
- Approval and export blocked unless the authorization is active and unexpired
- Invitations, authorizations, revocation takedown checklist per channel, treatment plans (mark sessions), 12-week follow-up texts, care team alerts
- Role-based access and per-facility scope; hash-chained audit log of every view, decision, export and message

**GoHighLevel:** test mode only. Follow-up texts are logged and shown, not sent. Connecting the real sub-account is a Phase 2 step that needs approval.

## What changes before real patients (Phase 2–3)

| Prototype | Production |
| --- | --- |
| JSON file in `data/` | PostgreSQL (Aurora) with row-level security, encryption at rest, backups |
| Videos on local disk | Private S3 with KMS encryption, signed URLs, transcoding and captions |
| Pick a sample staff account | SSO (Okta / Microsoft Entra) with required MFA |
| GoHighLevel test mode | Live GHL sub-account under its BAA, after confirming API/webhook coverage |
| Draft authorization text | Attorney-approved form (HIPAA + California CMIA), English and Spanish |
| Simple crisis word list | Clinician-reviewed list and response protocol |
| No outside services | Pen test, risk analysis, signed BAAs with every vendor |

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Run locally at http://localhost:3000 |
| `npm test` | Unit tests for timelines, invites, authorizations, audit chain, roles |
| `npm run build` | Production build (includes type checking) |
| `npm run reset-data` | Delete local sample data and test videos |

## Project layout

- `app/i/[token]` — invite link and code entry
- `app/p/*` — patient screens
- `app/staff/*` — staff dashboard
- `app/api/*` — server endpoints
- `lib/` — data, rules, timelines (`protocols.ts`), authorizations (`domain.ts`), audit chain, roles (`rbac.ts`), GoHighLevel (`ghl.ts`)
- `tests/` — unit tests
