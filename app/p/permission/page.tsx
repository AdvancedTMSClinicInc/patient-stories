import Link from "next/link";
import { requirePatient } from "@/lib/session";
import { readDb } from "@/lib/db";
import { CHANNEL_LABELS } from "@/lib/types";
import { fmtDateTime, fmtDayYear } from "@/lib/dates";
import PatientShell from "@/components/PatientShell";
import ActionButton from "@/components/ActionButton";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

const NAME_LABELS = { FIRST_NAME: "First name only", INITIALS: "Initials only", NONE: "No name" } as const;

export default async function Permission() {
  const ctx = await requirePatient();
  const db = readDb();
  const auths = db.authorizations
    .filter((a) => a.invitationId === ctx.invitation.id)
    .sort((a, b) => b.signedAt.localeCompare(a.signedAt));
  const current = auths[0];
  const version = current ? db.authorizationVersions.find((v) => v.id === current.versionId) : undefined;
  return (
    <PatientShell brand={ctx.brand} title="Your permission" subtitle="What you agreed to, and how to change your mind." backHref="/p">
      {!current ? (
        <div className="card">
          <p style={{ margin: 0 }}>You haven't given permission to share a video.</p>
          <Link className="btn btn-navy" href="/p/authorize">
            Review the permission form
          </Link>
        </div>
      ) : (
        <>
          <section className="card">
            <h2 className="eyebrow">Status</h2>
            {current.status === "ACTIVE" ? (
              <p className="success" style={{ margin: 0 }}>
                Active until {fmtDayYear(current.expiresOn)}
              </p>
            ) : (
              <p className="notice" style={{ margin: 0 }}>
                {current.status === "REVOKED" ? "Revoked" : "Expired"}
                {current.revokedAt ? ` on ${fmtDateTime(current.revokedAt)}` : ""}. Your video won't be used. Staff will remove it from
                anywhere it was published.
              </p>
            )}
            <dl className="details-grid">
              <dt>Signed</dt>
              <dd>
                {current.signedName}, {fmtDateTime(current.signedAt)}
              </dd>
              <dt>Channels</dt>
              <dd>{current.channels.map((c) => CHANNEL_LABELS[c]).join(", ")}</dd>
              <dt>Name shown</dt>
              <dd>{NAME_LABELS[current.nameDisplay]}</dd>
              <dt>Face</dt>
              <dd>{current.blurFace ? "Blurred" : "Shown"}</dd>
            </dl>
          </section>
          <details className="card">
            <summary style={{ fontWeight: 600, cursor: "pointer" }}>The form you signed (version {version?.version})</summary>
            <pre className="legal">{version?.body}</pre>
          </details>
          <PrintButton />
          {current.status === "ACTIVE" ? (
            <ActionButton
              url="/api/patient/authorization/revoke"
              body={{ authorizationId: current.id }}
              className="btn btn-danger btn-block"
              confirm="Revoke your permission? Your video won't be used, and staff will remove it anywhere it was published."
              label="Revoke my permission"
              busyLabel="Revoking…"
            />
          ) : null}
        </>
      )}
    </PatientShell>
  );
}
