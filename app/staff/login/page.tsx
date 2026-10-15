import { readDb } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/types";
import { sampleLoginAllowed } from "@/lib/flags";
import StaffLoginPicker from "@/components/StaffLoginPicker";

export const dynamic = "force-dynamic";

export default function StaffLogin() {
  const staff = readDb().staff.filter((s) => !s.disabled);
  return (
    <div className="p-wrap" style={{ maxWidth: 560 }}>
      <div className="logo-bar" style={{ gap: 18, padding: "0 16px", borderBottomColor: "var(--gold)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/advanced-tms.png" alt="Advanced TMS Clinic, Inc." style={{ height: 40 }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/pacific-health.png" alt="Pacific Health Systems" style={{ height: 36 }} />
      </div>
      <header className="p-header">
        <h1>Staff sign in</h1>
        <p>Prototype: choose a sample account to see what each role can do. The real app uses your company sign-in with two-step verification.</p>
      </header>
      <main className="p-main">
        {sampleLoginAllowed() ? (
          <StaffLoginPicker
            staff={staff.map((s) => ({ id: s.id, name: s.name, role: ROLE_LABELS[s.role] }))}
          />
        ) : (
          <p className="notice">Sample sign-in is turned off on this server.</p>
        )}
      </main>
    </div>
  );
}
