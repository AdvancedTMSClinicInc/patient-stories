import type { ProtocolCode, TreatmentPlan } from "./types";
import { addDays, diffDays, fmtDay, isWeekday, weekday } from "./dates";

// Treatment timelines. These are planning aids shown to patients as APPROXIMATE
// dates; the care team sets the real schedule. Templates must be approved by
// the medical director before use with real patients.

export const FOLLOW_UP_DAYS = 84; // 12 weeks
export const SPRAVATO_MONITORING_MS = 2 * 60 * 60 * 1000;

export const FOLLOW_UP_TEXT =
  "We'll text to see how you're feeling. Questions or want to talk about a booster? Text (855) ILUV-TMS.";
export const PATIENCE_NOTE =
  "Be patient: changes often build slowly. Many people notice them after about 2 weeks; some take longer.";

export type PhaseStatus = "done" | "now" | "next";
export interface TimelinePhase {
  key: string;
  title: string;
  when: string;
  sub: string;
  checkinText: string;
  status: PhaseStatus;
}
export type CheckinStatus = "done" | "due" | "upcoming";
export interface Checkin {
  milestone: string;
  label: string;
  dueOn: string;
  status: CheckinStatus;
}
export interface Timeline {
  protocol: ProtocolCode;
  summary: string;
  totalSessions: number | null;
  sessionDates: string[];
  phases: TimelinePhase[];
  checkins: Checkin[];
  nextCheckin: Checkin | null;
  patienceNote: string | null;
}

function firstWeekdayOnOrAfter(d: string): string {
  let x = d;
  while (!isWeekday(x)) x = addDays(x, 1);
  return x;
}

function nextDow(after: string, dow: number): string {
  let x = addDays(after, 1);
  while (weekday(x) !== dow) x = addDays(x, 1);
  return x;
}

/** 30 weekday sessions, then a taper of 3 + 2 + 1 sessions over three weeks. */
export function standardTmsDates(start: string): string[] {
  const dates: string[] = [];
  let d = firstWeekdayOnOrAfter(start);
  while (dates.length < 30) {
    if (isWeekday(d)) dates.push(d);
    d = addDays(d, 1);
  }
  const mon7 = nextDow(dates[29], 1);
  const taper = [
    mon7,
    addDays(mon7, 2),
    addDays(mon7, 4), // Mon, Wed, Fri
    addDays(mon7, 8),
    addDays(mon7, 10), // Tue, Thu
    addDays(mon7, 16), // Wed
  ];
  return dates.concat(taper);
}

export function acceleratedDates(start: string): string[] {
  const out: string[] = [];
  for (let day = 0; day < 5; day++) for (let i = 0; i < 10; i++) out.push(addDays(start, day));
  return out;
}

export function oneDayDates(start: string): string[] {
  return Array.from({ length: 20 }, () => start);
}

export const SPRAVATO_OFFSETS = [0, 3, 7, 10, 14, 17, 21, 24, 28, 35, 42, 49];
export function spravatoDates(start: string): string[] {
  return SPRAVATO_OFFSETS.map((o) => addDays(start, o));
}

export function plannedSessionDates(protocol: ProtocolCode, start: string): string[] {
  switch (protocol) {
    case "TMS_STANDARD":
      return standardTmsDates(start);
    case "TMS_ACCELERATED":
      return acceleratedDates(start);
    case "TMS_ONE_DAY":
      return oneDayDates(start);
    case "SPRAVATO":
      return spravatoDates(start);
    default:
      return [];
  }
}

/** Dates on which the 12-week text reminder is due, up to and including `until`. */
export function followUpDates(plan: Pick<TreatmentPlan, "protocol" | "startDate">, until: string): string[] {
  if (plan.protocol === "SPRAVATO") {
    // Every 12 weeks during maintenance, as a prompt to review the plan.
    const out: string[] = [];
    for (let k = 1; k < 100; k++) {
      const d = addDays(plan.startDate, FOLLOW_UP_DAYS * k);
      if (d > until) break;
      out.push(d);
    }
    return out;
  }
  const d = firstFollowUpDate(plan);
  return d <= until ? [d] : [];
}

export function firstFollowUpDate(plan: Pick<TreatmentPlan, "protocol" | "startDate">): string {
  const dates = plannedSessionDates(plan.protocol, plan.startDate);
  const anchor = plan.protocol === "SPRAVATO" || dates.length === 0 ? plan.startDate : dates[dates.length - 1];
  return addDays(anchor, FOLLOW_UP_DAYS);
}

export function nextFollowUpDate(plan: Pick<TreatmentPlan, "protocol" | "startDate">, today: string): string {
  if (plan.protocol !== "SPRAVATO") return firstFollowUpDate(plan);
  let k = 1;
  while (addDays(plan.startDate, FOLLOW_UP_DAYS * k) < today) k++;
  return addDays(plan.startDate, FOLLOW_UP_DAYS * k);
}

export function inSpravatoMonitoringWindow(plan: TreatmentPlan | null, now: Date = new Date()): boolean {
  if (!plan || plan.protocol !== "SPRAVATO" || !plan.lastSessionAt) return false;
  const elapsed = now.getTime() - new Date(plan.lastSessionAt).getTime();
  return elapsed >= 0 && elapsed < SPRAVATO_MONITORING_MS;
}

function sessionsStatus(completed: number, from: number, to: number): PhaseStatus {
  if (completed >= to) return "done";
  if (completed >= Math.max(from - 1, 1)) return "now";
  return "next";
}

function windowStatus(today: string, startDay: string, endDay: string, prereq: boolean): PhaseStatus {
  if (!prereq) return "next";
  if (today > endDay) return "done";
  if (today >= startDay) return "now";
  return "next";
}

function range(a: string, b: string): string {
  return a === b ? fmtDay(a) : `${fmtDay(a)} – ${fmtDay(b)}`;
}

/** Only the first "now" phase stays "now"; later ones become "next". */
function singleNow(phases: TimelinePhase[]): TimelinePhase[] {
  let seen = false;
  return phases.map((p) => {
    if (p.status !== "now") return p;
    if (seen) return { ...p, status: "next" };
    seen = true;
    return p;
  });
}

export function buildTimeline(plan: TreatmentPlan, today: string, recordedMilestones: Set<string>): Timeline {
  const start = plan.startDate;
  const c = plan.sessionsCompleted;
  const dates = plannedSessionDates(plan.protocol, start);
  const last = dates.at(-1) ?? start;
  const followUp = nextFollowUpDate(plan, today);
  const beforePhase = (title = "Before you start"): TimelinePhase => ({
    key: "before",
    title,
    when: fmtDay(start),
    sub: "Your starting point, in your own words.",
    checkinText: "Video check-in before treatment",
    status: c > 0 || (dates.length === 0 && today > start) ? "done" : "now",
  });
  const followUpPhase = (prereq: boolean): TimelinePhase => ({
    key: "followup",
    title: plan.protocol === "SPRAVATO" ? "Every 12 weeks" : "12-week follow-up",
    when: `About ${fmtDay(followUp)}`,
    sub: FOLLOW_UP_TEXT,
    checkinText: "Text reminder",
    status: windowStatus(today, followUp, addDays(followUp, 30), prereq),
  });

  let phases: TimelinePhase[] = [];
  let ck: Array<[string, string, string]> = []; // milestone, label, due
  let summary = "";
  let patienceNote: string | null = null;

  switch (plan.protocol) {
    case "TMS_STANDARD": {
      phases = [
        beforePhase(),
        {
          key: "daily",
          title: "Daily sessions",
          when: range(dates[0], dates[29]),
          sub: `30 sessions, Monday to Friday.${c > 0 && c < 30 ? ` You've completed ${c}.` : ""}`,
          checkinText: "Check-ins at sessions 10, 20 and 30",
          status: sessionsStatus(c, 1, 30),
        },
        {
          key: "taper",
          title: "Taper",
          when: range(dates[30], dates[35]),
          sub: "6 sessions: 3, then 2, then 1 per week.",
          checkinText: "Check-in at session 36",
          status: sessionsStatus(c, 31, 36),
        },
        {
          key: "after",
          title: "After treatment",
          when: range(addDays(last, 1), addDays(followUp, -1)),
          sub: "Follow-up visits with your care team. Keep journaling.",
          checkinText: "Check-in 1 month after",
          status: windowStatus(today, addDays(last, 1), addDays(followUp, -1), c >= 36),
        },
        followUpPhase(c >= 36),
      ];
      ck = [
        ["BEFORE", "Before session 1", start],
        ["S10", "Session 10", dates[9]],
        ["S20", "Session 20", dates[19]],
        ["S30", "Session 30", dates[29]],
        ["S36", "Session 36", dates[35]],
        ["M1_AFTER", "1 month after", addDays(last, 30)],
      ];
      summary = `Standard TMS · session ${Math.min(c, 36)} of 36`;
      break;
    }
    case "TMS_ACCELERATED": {
      const day = Math.min(5, Math.max(1, Math.ceil(c / 10)));
      phases = [
        beforePhase(),
        {
          key: "treatment",
          title: "Treatment days",
          when: range(dates[0], last),
          sub: `10 short sessions a day for 5 days.${c > 0 && c < 50 ? ` You're on day ${day}.` : ""}`,
          checkinText: "Check-in at the end of day 5",
          status: sessionsStatus(c, 1, 50),
        },
        {
          key: "week1",
          title: "First week after",
          when: range(addDays(last, 1), addDays(last, 7)),
          sub: "Rest and notice small changes.",
          checkinText: "Check-in at 1 week",
          status: windowStatus(today, addDays(last, 1), addDays(last, 7), c >= 50),
        },
        {
          key: "after",
          title: "Follow-up",
          when: range(addDays(last, 8), addDays(followUp, -1)),
          sub: "Follow-up visits with your care team.",
          checkinText: "Check-in at 1 month",
          status: windowStatus(today, addDays(last, 8), addDays(followUp, -1), c >= 50),
        },
        followUpPhase(c >= 50),
      ];
      ck = [
        ["BEFORE", "Before day 1", start],
        ["DAY5", "End of day 5", last],
        ["WEEK1", "1 week after", addDays(last, 7)],
        ["MONTH1", "1 month after", addDays(last, 30)],
      ];
      summary = c >= 50 ? "Accelerated TMS · treatment complete" : `Accelerated TMS · day ${day} of 5`;
      break;
    }
    case "TMS_ONE_DAY": {
      const weeksAfter = Math.max(0, Math.floor(diffDays(today, start) / 7));
      patienceNote = PATIENCE_NOTE;
      phases = [
        beforePhase("Before treatment"),
        {
          key: "treatment",
          title: "Treatment day",
          when: fmtDay(start),
          sub: "20 short sessions in one day. Rest afterward.",
          checkinText: "No check-in that day",
          status: sessionsStatus(c, 1, 20),
        },
        {
          key: "w1-4",
          title: "Weeks 1–4 after",
          when: range(addDays(start, 1), addDays(start, 28)),
          sub: PATIENCE_NOTE,
          checkinText: "Check-ins at weeks 2 and 4",
          status: windowStatus(today, addDays(start, 1), addDays(start, 28), c >= 20),
        },
        {
          key: "w5-12",
          title: "Weeks 5–12 after",
          when: range(addDays(start, 29), addDays(start, 83)),
          sub: "Keep journaling, even on hard days. Small changes count.",
          checkinText: "Check-ins at weeks 8 and 12",
          status: windowStatus(today, addDays(start, 29), addDays(start, 83), c >= 20),
        },
        followUpPhase(c >= 20),
      ];
      ck = [
        ["BEFORE", "Before treatment", start],
        ["W2", "Week 2", addDays(start, 14)],
        ["W4", "Week 4", addDays(start, 28)],
        ["W8", "Week 8", addDays(start, 56)],
        ["W12", "Week 12", addDays(start, 84)],
      ];
      summary = c >= 20 ? `One-Day TMS · week ${weeksAfter} after treatment` : "One-Day TMS";
      break;
    }
    case "SPRAVATO": {
      const week = Math.max(1, Math.floor(diffDays(today, start) / 7) + 1);
      phases = [
        beforePhase("Before your first dose"),
        {
          key: "induction",
          title: "Induction",
          when: range(dates[0], dates[7]),
          sub: `Twice a week for 4 weeks.${c > 0 && c < 8 ? ` You've completed ${c} of 8.` : ""}`,
          checkinText: "Check-in at the end of week 4",
          status: sessionsStatus(c, 1, 8),
        },
        {
          key: "weekly",
          title: "Once a week",
          when: range(dates[8], dates[11]),
          sub: "Weeks 5–8. Your prescriber reviews how you're doing.",
          checkinText: "Check-in at the end of week 8",
          status: sessionsStatus(c, 9, 12),
        },
        {
          key: "maintenance",
          title: "Maintenance",
          when: `From ${fmtDay(addDays(start, 56))}`,
          sub: "Every 1–2 weeks, as your prescriber decides.",
          checkinText: "Monthly check-ins",
          status: c >= 12 ? "now" : "next",
        },
        { ...followUpPhase(c >= 12), status: "next" },
      ];
      ck = [
        ["BEFORE", "Before your first dose", start],
        ["WEEK4", "End of week 4", addDays(start, 27)],
        ["WEEK8", "End of week 8", addDays(start, 55)],
        ["MONTH3", "Month 3", addDays(start, 84)],
        ["MONTH4", "Month 4", addDays(start, 112)],
        ["MONTH5", "Month 5", addDays(start, 140)],
      ];
      summary = `Spravato · week ${week}`;
      break;
    }
    case "THERAPY":
    case "PSYCHIATRY": {
      const week = Math.max(1, Math.floor(diffDays(today, start) / 7) + 1);
      const label = plan.protocol === "THERAPY" ? "Therapy" : "Psychiatry";
      phases = [
        beforePhase(),
        {
          key: "care",
          title: "Your care",
          when: range(start, addDays(start, 83)),
          sub: "Journal anytime. Monthly check-ins help you see your progress.",
          checkinText: "Monthly check-ins",
          status: windowStatus(today, start, addDays(start, 83), true),
        },
        followUpPhase(true),
      ];
      ck = [
        ["BEFORE", "Starting point", start],
        ["MONTH1", "Month 1", addDays(start, 30)],
        ["MONTH2", "Month 2", addDays(start, 60)],
        ["MONTH3", "Month 3", addDays(start, 90)],
      ];
      summary = `${label} · week ${week}`;
      break;
    }
  }

  const checkins: Checkin[] = ck.map(([milestone, label, dueOn]) => ({
    milestone,
    label,
    dueOn,
    status: recordedMilestones.has(milestone) ? "done" : dueOn <= today ? "due" : "upcoming",
  }));
  const nextCheckin = checkins.find((x) => x.status !== "done") ?? null;

  return {
    protocol: plan.protocol,
    summary,
    totalSessions: dates.length || null,
    sessionDates: dates,
    phases: singleNow(phases),
    checkins,
    nextCheckin,
    patienceNote,
  };
}

export function milestoneLabel(plan: TreatmentPlan, milestone: string, today: string): string {
  const t = buildTimeline(plan, today, new Set());
  return t.checkins.find((x) => x.milestone === milestone)?.label ?? milestone;
}
