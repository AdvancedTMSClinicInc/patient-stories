import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePatient } from "@/lib/session";
import { readDb } from "@/lib/db";
import { buildTimeline } from "@/lib/protocols";
import { fmtDay, todayStr } from "@/lib/dates";
import PatientShell from "@/components/PatientShell";

export const dynamic = "force-dynamic";

export default async function TimelinePage() {
  const ctx = await requirePatient();
  if (!ctx.plan) redirect("/p/journal");
  const recorded = new Set(
    readDb()
      .journalEntries.filter((e) => e.patientId === ctx.patient.id && e.milestone)
      .map((e) => e.milestone as string),
  );
  const t = buildTimeline(ctx.plan, todayStr(), recorded);
  return (
    <PatientShell
      brand={ctx.brand}
      eyebrow="Private to you"
      title="My treatment timeline"
      subtitle={t.summary}
      backHref="/p/journal"
      backLabel="Journal"
    >
      <ol className="tl">
        {t.phases.map((p) => (
          <li key={p.key} className={p.status}>
            <div className="rail" aria-hidden="true">
              <span className="node" />
              <span className="line" />
            </div>
            <div className="body">
              <div className="title">
                <span>
                  {p.title}
                  {p.status === "now" ? <span className="visually-hidden"> (you are here)</span> : null}
                </span>
                <span className="when">{p.when}</span>
              </div>
              <span className="small muted">{p.sub}</span>
              <span className={`pill ${p.status}`}>{p.checkinText}</span>
            </div>
          </li>
        ))}
      </ol>

      <section className="card" aria-labelledby="ck">
        <h2 id="ck" className="eyebrow">
          Video check-ins
        </h2>
        <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0, gap: 8 }}>
          {t.checkins.map((c) => (
            <li key={c.milestone} className="row">
              <span style={{ fontWeight: 600 }}>{c.label}</span>
              <span className="small muted">about {fmtDay(c.dueOn)}</span>
              <span className="spacer" />
              {c.status === "done" ? (
                <span className="badge good">Recorded</span>
              ) : (
                <Link className={`btn btn-small ${c.status === "due" ? "btn-gold" : "btn-outline"}`} href={`/p/checkin?m=${c.milestone}`}>
                  {c.status === "due" ? "Record now" : "Record early"}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>
      <p className="small muted" style={{ margin: 0 }}>
        Dates are approximate. Your care team sets and may change your schedule.
      </p>
    </PatientShell>
  );
}
