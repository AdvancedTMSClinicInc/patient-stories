import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePatient } from "@/lib/session";
import { readDb } from "@/lib/db";
import { buildTimeline } from "@/lib/protocols";
import { fmtDay, todayStr } from "@/lib/dates";
import PatientShell, { CrisisNote } from "@/components/PatientShell";
import MoodChart from "@/components/MoodChart";

export const dynamic = "force-dynamic";

export default async function Journal({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requirePatient();
  if (ctx.invitation.purpose === "TESTIMONIAL") redirect("/p");
  const sp = await searchParams;
  const db = readDb();
  const entries = db.journalEntries.filter((e) => e.patientId === ctx.patient.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const timeline = ctx.plan ? buildTimeline(ctx.plan, todayStr(), new Set(entries.map((e) => e.milestone).filter((m): m is string => !!m))) : null;
  const next = timeline?.nextCheckin;
  return (
    <PatientShell
      brand={ctx.brand}
      eyebrow="Private to you"
      title="My treatment journal"
      subtitle={
        <>
          {timeline?.summary ?? "Your private notes"} · <Link href="/p/timeline">See my timeline</Link>
        </>
      }
      backHref="/p"
      footer={<CrisisNote />}
    >
      {sp.saved ? (
        <p className="success" role="status" style={{ margin: 0 }}>
          Saved. Thank you for checking in.
        </p>
      ) : null}
      {timeline?.patienceNote ? <p className="notice" style={{ margin: 0 }}>{timeline.patienceNote}</p> : null}
      {next ? (
        <section className="card" style={{ background: "var(--navy)", color: "var(--white)", borderColor: "var(--navy)" }}>
          <span className="small" style={{ color: "var(--accent-on-navy)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
            {next.status === "due" ? "Video check-in due" : "Next video check-in"}
          </span>
          <span style={{ fontSize: 17, fontWeight: 600 }}>
            {next.label} · {next.status === "due" ? "ready now" : `about ${fmtDay(next.dueOn)}`}
          </span>
          <Link className="btn btn-gold" href={`/p/checkin?m=${next.milestone}`}>
            Record check-in
          </Link>
        </section>
      ) : null}
      <section className="card" aria-labelledby="mood">
        <div className="row">
          <h2 id="mood">Mood check-ins</h2>
          <span className="spacer" />
          <span className="small muted">0–10</span>
        </div>
        <MoodChart entries={entries} />
      </section>
      <Link className="btn btn-navy" href="/p/journal/new">
        + New entry
      </Link>
      <h2 className="eyebrow">Entries</h2>
      {entries.length === 0 ? <p className="muted" style={{ margin: 0 }}>No entries yet. Your first one can be just a few words.</p> : null}
      {entries.map((e) => (
        <article key={e.id} className="card" style={{ gap: 6 }}>
          <div className="row small muted">
            <span>
              {fmtDay(e.entryDate)}
              {e.milestone && timeline ? ` · ${timeline.checkins.find((c) => c.milestone === e.milestone)?.label ?? "Check-in"}` : ""}
            </span>
            <span className="spacer" />
            <span>
              Mood {e.mood} · Sleep {e.sleep} · Energy {e.energy}
            </span>
          </div>
          {e.body ? <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{e.body}</p> : null}
          {e.mediaId ? <video src={`/api/patient/media/${e.mediaId}`} controls playsInline preload="metadata" className="video-frame" /> : null}
          {e.sharedWithCareTeam ? <span className="small muted">Shared with your care team</span> : null}
        </article>
      ))}
    </PatientShell>
  );
}
