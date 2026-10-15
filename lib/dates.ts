// Date helpers working on plain YYYY-MM-DD strings in UTC, so results never
// shift by a day depending on the server's time zone.

export function todayStr(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function parseDay(d: string): Date {
  return new Date(`${d}T00:00:00Z`);
}

export function addDays(d: string, n: number): string {
  const x = parseDay(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

export function diffDays(a: string, b: string): number {
  return Math.round((parseDay(a).getTime() - parseDay(b).getTime()) / 86_400_000);
}

/** 0 = Sunday ... 6 = Saturday */
export function weekday(d: string): number {
  return parseDay(d).getUTCDay();
}

export function isWeekday(d: string): boolean {
  const w = weekday(d);
  return w >= 1 && w <= 5;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function fmtDay(d: string): string {
  return `${MONTHS[Number(d.slice(5, 7)) - 1]} ${Number(d.slice(8, 10))}`;
}

export function fmtDayYear(d: string): string {
  return `${fmtDay(d)}, ${d.slice(0, 4)}`;
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  });
}

export function isValidDay(d: unknown): d is string {
  return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(parseDay(d).getTime());
}
