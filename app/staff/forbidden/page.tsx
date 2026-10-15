import Link from "next/link";
import { requireStaff } from "@/lib/session";
import StaffShell, { homeFor } from "@/components/StaffShell";

export const dynamic = "force-dynamic";

export default async function Forbidden() {
  const staff = await requireStaff();
  return (
    <StaffShell user={staff} active="">
      <h1>Not available for your role</h1>
      <p className="muted">Your account doesn't have access to that page. This keeps marketing and clinical information separate.</p>
      <Link className="btn btn-navy" href={homeFor(staff)} style={{ alignSelf: "flex-start" }}>
        Go to my start page
      </Link>
    </StaffShell>
  );
}
