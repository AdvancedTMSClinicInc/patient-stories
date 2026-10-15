import { endPatientSession } from "@/lib/session";
import { json } from "@/lib/http";

export async function POST() {
  await endPatientSession();
  return json({ ok: true });
}
