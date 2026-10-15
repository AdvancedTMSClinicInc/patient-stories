"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Recorder from "./Recorder";

const CHECKIN_PROMPTS = [
  "How are you feeling today, in your own words?",
  "What has changed since you started?",
  "What has been hardest lately?",
  "What are you hoping for next?",
];

function Scale({ label, value, onChange, low, high }: { label: string; value: number; onChange: (n: number) => void; low: string; high: string }) {
  const id = label.toLowerCase().replace(/\W+/g, "-");
  return (
    <div className="field">
      <span className="label" id={id}>
        {label}: <strong>{value}</strong>
      </span>
      <div className="scale" role="group" aria-labelledby={id}>
        {Array.from({ length: 11 }, (_, n) => (
          <button key={n} type="button" aria-pressed={n === value} aria-label={`${label} ${n}`} onClick={() => onChange(n)}>
            {n}
          </button>
        ))}
      </div>
      <div className="row small muted">
        <span>{low}</span>
        <span className="spacer" />
        <span>{high}</span>
      </div>
    </div>
  );
}

interface Props {
  milestone: string | null;
  milestoneLabel: string | null;
  defaultVideo: boolean;
}

export default function JournalForm({ milestone, milestoneLabel, defaultVideo }: Props) {
  const router = useRouter();
  const [mood, setMood] = useState(5);
  const [sleep, setSleep] = useState(5);
  const [energy, setEnergy] = useState(5);
  const [body, setBody] = useState("");
  const [shared, setShared] = useState(false);
  const [withVideo, setWithVideo] = useState(defaultVideo);
  const [mediaId, setMediaId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flagged, setFlagged] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/patient/journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, mood, sleep, energy, milestone, mediaId, sharedWithCareTeam: shared }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; flagged?: boolean };
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Couldn't save. Please try again.");
      return;
    }
    if (data.flagged) {
      setFlagged(true);
      return;
    }
    router.push("/p/journal?saved=1");
    router.refresh();
  }

  if (flagged) {
    return (
      <div className="card" role="alert">
        <h2>Thank you for telling us</h2>
        <p style={{ margin: 0 }}>
          Your entry is saved. It sounds like things may be really hard right now. You don't have to go through this alone.
        </p>
        <a className="btn btn-gold" href="tel:988">
          Call or text 988
        </a>
        <p className="small" style={{ margin: 0 }}>
          988 Suicide &amp; Crisis Lifeline is free and open 24/7. If you're in danger right now, call 911. Your clinic's care
          team will also see that you may need support.
        </p>
        <a className="btn btn-outline" href="/p/journal">
          Back to my journal
        </a>
      </div>
    );
  }

  return (
    <div className="stack">
      {milestoneLabel ? <p className="eyebrow">Check-in: {milestoneLabel}</p> : null}
      <div className="card">
        <Scale label="Mood" value={mood} onChange={setMood} low="Very low" high="Great" />
        <Scale label="Sleep" value={sleep} onChange={setSleep} low="Very poor" high="Great" />
        <Scale label="Energy" value={energy} onChange={setEnergy} low="None" high="Plenty" />
      </div>
      <div className="field">
        <label htmlFor="body">What changed this week? (optional)</label>
        <textarea id="body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} />
      </div>
      <label className="check">
        <input type="checkbox" checked={withVideo} onChange={(e) => setWithVideo(e.target.checked)} disabled={mediaId !== null} />
        Add a short private video
      </label>
      {withVideo && !mediaId ? (
        <Recorder
          prompts={CHECKIN_PROMPTS}
          minSeconds={5}
          maxSeconds={120}
          uploadUrl="/api/patient/journal-media"
          submitLabel="Attach this video"
          onUploaded={(d) => setMediaId(typeof d.mediaId === "string" ? d.mediaId : null)}
        />
      ) : null}
      {mediaId ? (
        <p className="success" style={{ margin: 0 }}>
          Video attached. Only you can see it unless you share this entry with your care team.
        </p>
      ) : null}
      <label className="check">
        <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />
        Share this entry with my care team
      </label>
      <p className="small muted" style={{ margin: 0 }}>
        Your journal is never used for marketing.
      </p>
      {error ? (
        <p className="error" role="alert" style={{ margin: 0 }}>
          {error}
        </p>
      ) : null}
      <button type="button" className="btn btn-gold btn-block" onClick={save} disabled={busy || (withVideo && !mediaId && !body.trim())}>
        {busy ? "Saving…" : "Save entry"}
      </button>
    </div>
  );
}
