"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  url: string;
  body?: unknown;
  label: string;
  busyLabel?: string;
  className?: string;
  confirm?: string;
  redirectTo?: string;
  onDone?: (data: Record<string, unknown>) => void;
}

/** A button that POSTs JSON, then refreshes or navigates. Shows errors inline. */
export default function ActionButton({ url, body, label, busyLabel, className = "btn btn-navy", confirm, redirectTo, onDone }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (confirm && !window.confirm(confirm)) return;
    setBusy(true);
    setError(null);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    setBusy(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Something went wrong.");
      return;
    }
    onDone?.(data);
    if (redirectTo) router.push(redirectTo);
    router.refresh();
  }

  return (
    <span className="stack" style={{ gap: 6 }}>
      <button type="button" className={className} onClick={run} disabled={busy}>
        {busy ? busyLabel ?? "Working…" : label}
      </button>
      {error ? (
        <span className="error" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}
