import Link from "next/link";

/** Shown during the 2-hour Spravato monitoring window instead of any prompt or signature. */
export default function RestNotice() {
  return (
    <div className="card">
      <h2>Rest today</h2>
      <p style={{ margin: 0 }}>
        You had a treatment in the last two hours. Recording and signing forms are paused for now. We'll remind you
        tomorrow, and you can come back anytime.
      </p>
      <Link className="btn btn-outline" href="/p">
        Back to start
      </Link>
    </div>
  );
}
