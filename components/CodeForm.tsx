"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CodeForm({ token }: { token: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/patient/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, code }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (res.ok) {
      router.replace("/p");
      router.refresh();
    } else {
      setError(data.error ?? "That didn't work. Please try again.");
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor="code">Your 6-digit code</label>
        <input
          id="code"
          className="code-input"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          aria-describedby={error ? "code-error" : undefined}
          required
        />
      </div>
      {error ? (
        <p id="code-error" className="error" role="alert" style={{ margin: 0 }}>
          {error}
        </p>
      ) : null}
      <button className="btn btn-gold btn-block" type="submit" disabled={busy || code.length !== 6}>
        {busy ? "Checking…" : "Continue"}
      </button>
    </form>
  );
}
