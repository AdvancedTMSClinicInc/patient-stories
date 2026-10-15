import Link from "next/link";
import { requirePatient } from "@/lib/session";
import { SERVICE_LABELS } from "@/lib/types";
import PatientShell from "@/components/PatientShell";
import SignOutButton from "@/components/SignOutButton";

export const dynamic = "force-dynamic";

export default async function Welcome() {
  const ctx = await requirePatient();
  const { patient, facility, location, invitation, brand } = ctx;
  const canRecord = invitation.purpose !== "JOURNAL";
  const canJournal = invitation.purpose !== "TESTIMONIAL";
  return (
    <PatientShell
      brand={brand}
      title={`Hi ${patient.firstName}, thank you for being here.`}
      subtitle="Your care team invited you to share your experience. Everything stays private unless you choose otherwise."
      footer={
        <div className="row">
          <span>Your care never depends on taking part.</span>
          <span className="spacer" />
          <SignOutButton />
        </div>
      }
    >
      <section className="card" aria-labelledby="details">
        <h2 id="details" className="eyebrow">
          Confirm your details
        </h2>
        <dl className="details-grid">
          <dt>Facility</dt>
          <dd>{facility.legalName}</dd>
          <dt>Location</dt>
          <dd>{location.name}</dd>
          <dt>Service</dt>
          <dd>{invitation.services.map((s) => SERVICE_LABELS[s]).join(", ")}</dd>
        </dl>
        <a className="small" href="sms:+18554588867">
          Something wrong? Text us at (855) ILUV-TMS
        </a>
      </section>

      <h2 className="display" style={{ margin: "4px 0 0", fontSize: 22 }}>
        What would you like to do?
      </h2>
      {canRecord ? (
        <Link className="choice choice-navy" href={ctx.authorization ? "/p/record" : "/p/authorize"}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6" aria-hidden="true">
            <rect x="3" y="6" width="13" height="12" rx="2" />
            <path d="M16 10l5-3v10l-5-3" />
          </svg>
          <span>
            <span className="t">Record a video story</span>
            <span className="s">1–2 minutes, with guided questions</span>
          </span>
        </Link>
      ) : null}
      {canJournal ? (
        <Link className="choice choice-light" href="/p/journal">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--navy)" strokeWidth="1.6" aria-hidden="true">
            <path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3z" />
            <path d="M9 9h6M9 13h6" />
          </svg>
          <span>
            <span className="t">Open my treatment journal</span>
            <span className="s">Private notes, check-ins and your timeline</span>
          </span>
        </Link>
      ) : null}
      {ctx.authorization ? (
        <p className="small muted" style={{ margin: 0 }}>
          You've given permission to share your story. <Link href="/p/permission">View or change it</Link>.
        </p>
      ) : null}
    </PatientShell>
  );
}
