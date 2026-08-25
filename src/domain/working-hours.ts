import type { Enquiry, WorkspacePrefs } from "./types";

const ZONE = "Australia/Brisbane";
const WEEKDAY: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function parseHm(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function zoned(date: Date, timeZone = ZONE): { day: number; mins: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return { day: WEEKDAY[weekday] ?? 1, mins: hour * 60 + minute };
}

function isWorkingDay(day: number, workingDays: string): boolean {
  if (/seven|every day|daily/i.test(workingDays)) return true;
  if (/weekend/i.test(workingDays) && !/weekday|monday/i.test(workingDays)) {
    return day === 0 || day === 6;
  }
  return day >= 1 && day <= 5;
}

/** Minutes that fall inside the studio’s working hours between two instants. */
export function workingMinutesBetween(from: Date, to: Date, prefs: WorkspacePrefs): number {
  if (to <= from) return 0;
  const start = parseHm(prefs.hoursStart || "08:00");
  const end = parseHm(prefs.hoursEnd || "17:30");
  if (end <= start) return 0;
  const tz = prefs.timezone || ZONE;
  let minutes = 0;
  const step = 15 * 60 * 1000;
  let t = from.getTime();
  while (t < to.getTime()) {
    const d = new Date(t);
    const { day, mins } = zoned(d, tz);
    if (isWorkingDay(day, prefs.workingDays) && mins >= start && mins < end) {
      minutes += Math.min(15, (to.getTime() - t) / 60_000);
    }
    t += step;
  }
  return minutes;
}

/** Two working days at 8 hours. Silence is not a decline before this. */
export const FOLLOW_UP_AFTER_MINUTES = 16 * 60;

export function shouldReleaseFollowUp(
  enquiry: Enquiry,
  prefs: WorkspacePrefs,
  now = new Date(),
): boolean {
  if (enquiry.state.lifecycle !== "OPEN") return false;
  if (enquiry.followUpDue) return false;
  if (enquiry.snoozedUntil && Date.parse(enquiry.snoozedUntil) > now.getTime()) return false;
  if (enquiry.state.decision !== "WAITING_ON_CLIENT") return false;
  if (enquiry.state.commercial !== "QUOTED" && enquiry.state.commercial !== "ESTIMATED") return false;
  const lastOut = [...enquiry.conversation].reverse().find((m) => m.direction === "outbound");
  if (!lastOut) return false;
  return workingMinutesBetween(new Date(lastOut.at), now, prefs) >= FOLLOW_UP_AFTER_MINUTES;
}
