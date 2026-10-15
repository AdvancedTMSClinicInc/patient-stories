import Link from "next/link";
import { notFound } from "next/navigation";
import { readDevInvites } from "@/lib/db";

export const dynamic = "force-dynamic";

// Testing aid: shows the sample patients' links and codes. Disabled in production.
export default function DevPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const invites = readDevInvites();
  return (
    <div className="p-wrap" style={{ maxWidth: 760 }}>
      <header className="p-header">
        <h1>Sample patient links</h1>
        <p>For testing only. These are made-up patients. Open a link, then type its code.</p>
      </header>
      <main className="p-main">
        <div className="table-box">
          <table className="s-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Facility · location</th>
                <th>Treatment plan</th>
                <th>Code</th>
                <th>Link</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((i) => (
                <tr key={i.path}>
                  <td>{i.patient}</td>
                  <td>
                    {i.facility} · {i.location}
                  </td>
                  <td>{i.plan}</td>
                  <td className="mono" style={{ fontSize: 16 }}>
                    {i.code}
                  </td>
                  <td>
                    <Link href={i.path}>Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">
          Invitations you create in the staff dashboard also appear here. To start over with fresh sample data, stop the app and
          run <span className="mono">npm run reset-data</span>.
        </p>
        <Link className="btn btn-navy" href="/staff/login">
          Staff sign in
        </Link>
      </main>
    </div>
  );
}
