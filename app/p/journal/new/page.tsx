import { redirect } from "next/navigation";
import { requirePatient } from "@/lib/session";
import { inSpravatoMonitoringWindow } from "@/lib/protocols";
import PatientShell, { CrisisNote } from "@/components/PatientShell";
import JournalForm from "@/components/JournalForm";
import RestNotice from "@/components/RestNotice";

export const dynamic = "force-dynamic";

export default async function NewEntry() {
  const ctx = await requirePatient();
  if (ctx.invitation.purpose === "TESTIMONIAL") redirect("/p");
  return (
    <PatientShell brand={ctx.brand} eyebrow="Private to you" title="New journal entry" backHref="/p/journal" footer={<CrisisNote />}>
      {inSpravatoMonitoringWindow(ctx.plan) ? <RestNotice /> : <JournalForm milestone={null} milestoneLabel={null} defaultVideo={false} />}
    </PatientShell>
  );
}
