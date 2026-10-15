import type { DB, Patient, ReminderLog, TreatmentPlan } from "./types";
import { newId } from "./crypto";
import { appendAudit } from "./audit";
import { REPLY_PHONE_DISPLAY } from "./brand";

// GoHighLevel connection.
// PROTOTYPE: mock mode only. Messages are written to the reminders log and
// shown on the staff Follow-ups page; nothing leaves this computer.
// Connecting the real GHL sub-account is a Gate 2 step that needs approval,
// a HIPAA-enabled sub-account and confirmation that API/webhook traffic is
// covered by the BAA. Only first name, phone, facility, location and the
// milestone are ever sent - no videos, journal text or scores.

export function ghlMode(): "mock" | "live" {
  return process.env.GHL_MODE === "live" ? "live" : "mock";
}

export function followUpMessage(patient: Pick<Patient, "firstName">, plan: Pick<TreatmentPlan, "protocol">): string {
  const opener =
    plan.protocol === "SPRAVATO"
      ? "it's been a while since we last checked in."
      : "it's been about 3 months since you finished treatment with us.";
  return `Hi ${patient.firstName}, ${opener} How are you feeling? If you'd like to talk about a booster or next steps, just text us at ${REPLY_PHONE_DISPLAY}. Reply STOP to opt out.`;
}

export function maskPhone(phone: string | null): string {
  if (!phone) return "no phone on file";
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 4 ? `***-***-${digits.slice(-4)}` : "***";
}

export function sendFollowUp(
  db: DB,
  plan: TreatmentPlan,
  patient: Patient,
  dueOn: string,
  staffId: string,
  now: Date = new Date(),
): ReminderLog {
  if (ghlMode() === "live") {
    throw new Error("Live GoHighLevel sending is not enabled in the prototype. It requires approval at Gate 2.");
  }
  const log: ReminderLog = {
    id: newId(),
    treatmentPlanId: plan.id,
    patientId: patient.id,
    dueOn,
    sentAt: now.toISOString(),
    sentBy: staffId,
    via: "GHL_MOCK",
    toPhoneMasked: maskPhone(patient.phone),
    message: followUpMessage(patient, plan),
  };
  db.reminders.push(log);
  appendAudit(
    db,
    {
      actorType: "STAFF",
      actorId: staffId,
      action: "FOLLOWUP_SENT_MOCK",
      entity: "treatment_plan",
      entityId: plan.id,
      facilityId: plan.facilityId,
      detail: { dueOn, via: log.via },
    },
    now,
  );
  return log;
}
