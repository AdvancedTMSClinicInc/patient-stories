"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  channels: { value: string; label: string }[];
  fullName: string;
}

export default function AuthorizationForm({ channels, fullName }: Props) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>([]);
  const [nameDisplay, setNameDisplay] = useState("FIRST_NAME");
  const [blurFace, setBlurFace] = useState(false);
  const [years, setYears] = useState(3);
  const [signedName, setSignedName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function toggle(v: string) {
    setPicked((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/patient/authorization", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channels: picked, nameDisplay, blurFace, years, signedName, agreed }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (res.ok) {
      router.push("/p/record");
      router.refresh();
    } else {
      setError(data.error ?? "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <fieldset>
        <legend>Where may we share your video?</legend>
        {channels.map((c) => (
          <label className="check" key={c.value}>
            <input type="checkbox" checked={picked.includes(c.value)} onChange={() => toggle(c.value)} />
            {c.label}
          </label>
        ))}
      </fieldset>

      <div className="field">
        <label htmlFor="nameDisplay">Show my name as</label>
        <select id="nameDisplay" value={nameDisplay} onChange={(e) => setNameDisplay(e.target.value)}>
          <option value="FIRST_NAME">First name only</option>
          <option value="INITIALS">Initials only</option>
          <option value="NONE">No name</option>
        </select>
      </div>

      <label className="check">
        <input type="checkbox" checked={blurFace} onChange={(e) => setBlurFace(e.target.checked)} />
        Blur my face (voice only)
      </label>

      <div className="field">
        <label htmlFor="years">This permission ends after</label>
        <select id="years" value={years} onChange={(e) => setYears(Number(e.target.value))}>
          <option value={1}>1 year</option>
          <option value={2}>2 years</option>
          <option value={3}>3 years</option>
        </select>
      </div>

      <label className="check">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        I have read the authorization above and I agree to it.
      </label>

      <div className="field">
        <label htmlFor="sig">Type your full name to sign</label>
        <input
          id="sig"
          type="text"
          autoComplete="name"
          placeholder={fullName}
          value={signedName}
          onChange={(e) => setSignedName(e.target.value)}
          style={{ fontFamily: "var(--font-display)", fontSize: 18 }}
        />
      </div>

      <p className="small muted" style={{ margin: 0 }}>
        You can revoke this at any time from this app or by contacting your clinic. We'll email you a copy.
      </p>

      {error ? (
        <p className="error" role="alert" style={{ margin: 0 }}>
          {error}
        </p>
      ) : null}
      <button className="btn btn-gold btn-block" type="submit" disabled={busy}>
        {busy ? "Saving…" : "Sign and continue"}
      </button>
      <a className="btn btn-outline btn-block" href="/p">
        Not now
      </a>
    </form>
  );
}
