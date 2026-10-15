"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StaffLoginPicker({ staff }: { staff: { id: string; name: string; role: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(id: string) {
    setBusy(id);
    setError(null);
    const res = await fetch("/api/staff/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffId: id }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; home?: string };
    if (res.ok) {
      router.replace(data.home ?? "/staff");
      router.refresh();
    } else {
      setError(data.error ?? "Couldn't sign in.");
      setBusy(null);
    }
  }

  return (
    <div className="stack">
      {staff.map((s) => (
        <button key={s.id} type="button" className="choice choice-light" style={{ textAlign: "left", font: "inherit", cursor: "pointer" }} onClick={() => pick(s.id)} disabled={busy !== null}>
          <span>
            <span className="t">{s.name}</span>
            <span className="s">{busy === s.id ? "Signing in…" : s.role}</span>
          </span>
        </button>
      ))}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
