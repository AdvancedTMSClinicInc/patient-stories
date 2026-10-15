"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DecisionForm({ testimonialId, canApprove }: { testimonialId: string; canApprove: boolean }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "APPROVE" | "REJECT") {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/staff/testimonials/${testimonialId}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, reason }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) setError(data.error ?? "Couldn't save the decision.");
    else router.refresh();
  }

  return (
    <section className="card">
      <h2>Your decision</h2>
      <div className="field">
        <label htmlFor="reason">Review note (required to reject)</label>
        <textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} style={{ minHeight: 70 }} />
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        Before approving: check claims about results stay within approved uses, and that the patient's name and face settings
        will be followed.
      </p>
      {error ? (
        <p className="error" role="alert" style={{ margin: 0 }}>
          {error}
        </p>
      ) : null}
      <div className="row">
        <button className="btn btn-gold" type="button" onClick={() => decide("APPROVE")} disabled={busy || !canApprove} style={{ flex: 1 }}>
          Approve
        </button>
        <button className="btn btn-outline" type="button" onClick={() => decide("REJECT")} disabled={busy} style={{ flex: 1 }}>
          Reject
        </button>
      </div>
      {!canApprove ? <p className="small error" style={{ margin: 0 }}>Can't approve: the authorization isn't active.</p> : null}
    </section>
  );
}
