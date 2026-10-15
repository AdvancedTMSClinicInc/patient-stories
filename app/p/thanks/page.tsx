import Link from "next/link";
import { requirePatient } from "@/lib/session";
import PatientShell from "@/components/PatientShell";

export const dynamic = "force-dynamic";

export default async function Thanks() {
  const ctx = await requirePatient();
  const { patient, location, facility, brand } = ctx;
  return (
    <PatientShell
      brand={brand}
      eyebrow="Step 3 of 3"
      title={`Thank you, ${patient.firstName}.`}
      subtitle={`Your video was sent privately to our team in ${location.name}. Nothing is published until staff review it, and only on the channels you chose.`}
    >
      {/* Shown to every patient the same way, with no incentive (no review gating). */}
      <section className="card" aria-labelledby="g">
        <h2 id="g">Would you also leave a Google review?</h2>
        <p className="muted small" style={{ margin: 0 }}>
          Honest feedback of any kind helps others find care. It opens Google in a new tab and is completely optional.
        </p>
        <a className="btn btn-navy" href={location.googleReviewUrl} target="_blank" rel="noopener noreferrer">
          Review {facility.name}, {location.name}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M7 17L17 7M9 7h8v8" />
          </svg>
        </a>
      </section>
      <div className="stack small">
        <Link href="/p/permission">View or revoke my permission</Link>
        {ctx.invitation.purpose !== "TESTIMONIAL" ? <Link href="/p/journal">Go to my treatment journal</Link> : null}
        <Link href="/p">Back to start</Link>
      </div>
    </PatientShell>
  );
}
