export default function Expired() {
  return (
    <div className="p-wrap">
      <header className="p-header">
        <h1>Please open your link again</h1>
        <p>For your privacy, you're signed out after 30 minutes without activity, or when an invitation expires.</p>
      </header>
      <main className="p-main">
        <div className="card">
          <p style={{ margin: 0 }}>
            Open the link your clinic sent you and enter your code. If your link has expired, text us at{" "}
            <a href="sms:+18554588867">(855) ILUV-TMS</a> and we'll send a new one.
          </p>
        </div>
      </main>
    </div>
  );
}
