import Link from "next/link";

export default function Home() {
  return (
    <div className="p-wrap">
      <div className="logo-bar" style={{ gap: 18, padding: "0 16px", borderBottomColor: "var(--gold)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/advanced-tms.png" alt="Advanced TMS Clinic, Inc." style={{ height: 40 }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/pacific-health.png" alt="Pacific Health Systems" style={{ height: 36 }} />
      </div>
      <header className="p-header">
        <h1>Patient Stories</h1>
        <p>A private place for patients to record their story and keep a treatment journal.</p>
      </header>
      <main className="p-main">
        <div className="card">
          <h2>Patients</h2>
          <p className="muted small" style={{ margin: 0 }}>
            Open the personal link your clinic sent you by text or email. You'll need the 6-digit code that came with it.
          </p>
        </div>
        <Link className="btn btn-navy" href="/staff/login">
          Staff sign in
        </Link>
        {process.env.NODE_ENV !== "production" ? (
          <Link className="btn btn-outline" href="/dev">
            Sample patient links (testing only)
          </Link>
        ) : null}
      </main>
    </div>
  );
}
