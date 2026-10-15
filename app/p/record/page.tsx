import { redirect } from "next/navigation";
import { requirePatient } from "@/lib/session";
import { inSpravatoMonitoringWindow } from "@/lib/protocols";
import { MAX_SECONDS, MIN_SECONDS } from "@/lib/domain";
import { SERVICE_LABELS } from "@/lib/types";
import PatientShell, { CrisisNote } from "@/components/PatientShell";
import RestNotice from "@/components/RestNotice";
import TestimonialRecorder from "@/components/TestimonialRecorder";

export const dynamic = "force-dynamic";

export default async function Record() {
  const ctx = await requirePatient();
  if (ctx.invitation.purpose === "JOURNAL") redirect("/p");
  if (!ctx.authorization) redirect("/p/authorize");
  const service = ctx.invitation.services.map((s) => SERVICE_LABELS[s]).join(" and ");
  const prompts = [
    "What was life like before you started treatment?",
    `What made you decide to try ${service} with us?`,
    "What was a typical visit like for you?",
    "What changes have you noticed in your mood, sleep, work or relationships?",
    "What would you tell someone who is thinking about starting?",
  ];
  // Testing convenience: TESTIMONIAL_MIN_SECONDS can lower the minimum on a dev machine.
  const minSeconds = Math.max(5, Number(process.env.TESTIMONIAL_MIN_SECONDS ?? MIN_SECONDS));
  return (
    <PatientShell
      brand={ctx.brand}
      eyebrow="Step 2 of 3"
      title="Record your story"
      subtitle="1 to 2 minutes. Speak naturally. There are no wrong answers."
      backHref="/p"
      footer={<CrisisNote />}
    >
      {inSpravatoMonitoringWindow(ctx.plan) ? (
        <RestNotice />
      ) : (
        <TestimonialRecorder prompts={prompts} minSeconds={minSeconds} maxSeconds={MAX_SECONDS} />
      )}
    </PatientShell>
  );
}
