import { requirePatient } from "@/lib/session";
import { readDb } from "@/lib/db";
import { inSpravatoMonitoringWindow } from "@/lib/protocols";
import { CHANNEL_LABELS, type Channel } from "@/lib/types";
import PatientShell from "@/components/PatientShell";
import AuthorizationForm from "@/components/AuthorizationForm";
import RestNotice from "@/components/RestNotice";

export const dynamic = "force-dynamic";

export default async function Authorize() {
  const ctx = await requirePatient();
  const db = readDb();
  const version = db.authorizationVersions
    .filter((v) => v.facilityId === ctx.facility.id)
    .sort((a, b) => b.version - a.version)[0];
  const resting = inSpravatoMonitoringWindow(ctx.plan);
  return (
    <PatientShell
      brand={ctx.brand}
      eyebrow="Step 1 of 3"
      title="Permission to share your story"
      subtitle="This is separate from your treatment consent. Saying no never affects your care."
      backHref="/p"
    >
      {resting ? (
        <RestNotice />
      ) : (
        <>
          <details className="card">
            <summary style={{ fontWeight: 600, cursor: "pointer" }}>Read the full authorization (version {version?.version})</summary>
            <pre className="legal">{version?.body}</pre>
          </details>
          <AuthorizationForm
            channels={(Object.keys(CHANNEL_LABELS) as Channel[]).map((c) => ({ value: c, label: CHANNEL_LABELS[c] }))}
            fullName={`${ctx.patient.firstName} ${ctx.patient.lastName}`}
          />
        </>
      )}
    </PatientShell>
  );
}
