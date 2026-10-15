import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/session";
import { homeFor } from "@/lib/staffnav";

export const dynamic = "force-dynamic";

export default async function StaffHome() {
  const staff = await requireStaff();
  redirect(homeFor(staff));
}
