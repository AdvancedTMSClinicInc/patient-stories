import { redirect } from "next/navigation";
import { requirePatient } from "@/lib/session";
import { buildTimeline, inSpravatoMonitoringWindow } from "@/lib/protocols";
import { todayStr } from "@/lib/dates";
import PatientShell, { CrisisNote } from "@/components/PatientShell";
import JournalForm from "@/components/JournalForm";
import RestNotice from "@/components/RestNotice";

export const dynamic = "force-dynamic";

export default async function Checkin({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requirePatient();
  if (ctx.invitation.purpose === "TESTIMONIAL" || !ctx.plan) redirect("/p");
  const { m } = await searchParams;
  const timeline = buildTimeline(ctx.plan, todayStr(), new Set());
  const checkin = timeline.checkins.find((c) => c.milestone === m);
  if (!checkin) redirect("/p/journal");
  return (
    <PatientShell
      brand={ctx.brand}
      eyebrow="Private video check-in"
      title={checkin.label}
      subtitle="A quick check-in so you can look back and see how far you've come. Only you see it unless you share it."
      backHref="/p/journal"
      footer={<CrisisNote />}
    >
      {timeline.patienceNote ? <p className="notice" style={{ margin: 0 }}>{timeline.patienceNote}</p> : null}
      {inSpravatoMonitoringWindow(ctx.plan) ? (
        <RestNotice />
      ) : (
        <JournalForm milestone={checkin.milestone} milestoneLabel={checkin.label} defaultVideo={true} />
      )}
    </PatientShell>
  );
}
