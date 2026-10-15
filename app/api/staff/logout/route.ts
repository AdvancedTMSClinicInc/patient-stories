import { endStaffSession } from "@/lib/session";
import { json } from "@/lib/http";

export async function POST() {
  await endStaffSession();
  return json({ ok: true });
}
