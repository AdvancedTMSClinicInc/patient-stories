import { readDb } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { BRANDS } from "@/lib/brand";
import PatientShell from "@/components/PatientShell";
import CodeForm from "@/components/CodeForm";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = readDb();
  const invitation = db.invitations.find((i) => i.tokenHash === sha256(token));
  const facility = invitation ? db.facilities.find((f) => f.id === invitation.facilityId) : undefined;
  const brand = BRANDS[facility?.code ?? "ATMS"];
  return (
    <PatientShell
      brand={brand}
      title="Welcome"
      subtitle="For your privacy, enter the 6-digit code we sent you separately."
    >
      <CodeForm token={token} />
      <p className="muted small" style={{ margin: 0 }}>
        Didn't get a code, or it isn't working? Text us at <a href="sms:+18554588867">(855) ILUV-TMS</a>.
      </p>
    </PatientShell>
  );
}
