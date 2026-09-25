import type { WorkspacePrefs } from "./types";

/**
 * Workspace preferences: working hours and in-app notices.
 *
 * Notices default OFF. The owner opts in, once, in plain words. A product sold
 * as calm cannot start by deciding for them that every arrival deserves an
 * interruption. Working hours default to a plain weekday day so follow-ups
 * have something honest to count against until the owner says otherwise.
 */
export const DEFAULT_PREFS: WorkspacePrefs = {
  hoursStart: "08:00",
  hoursEnd: "17:30",
  workingDays: "Monday to Friday",
  timezone: "Australia/Brisbane",
  notifyArrival: false,
  notifyFollowUp: false,
  notifyLearning: false,
};

const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
/** The choices Settings offers. Stored text is read by working-hours.ts `isWorkingDay`. */
export const WORKING_DAY_CHOICES = [
  "Monday to Friday",
  "Monday to Saturday",
  "Every day",
  "Weekends",
] as const;
const NOTIFY_KEYS = ["notifyArrival", "notifyFollowUp", "notifyLearning"] as const;

/**
 * Keep only well-formed preference values from untrusted input.
 *
 * Used at the server boundary (the client sends these) and when reading the
 * stored document back, so a malformed row can never reach the working-hours
 * maths as NaN minutes.
 */
export function cleanPrefs(raw: unknown): Partial<WorkspacePrefs> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const d = raw as Record<string, unknown>;
  const out: Partial<WorkspacePrefs> = {};
  if (typeof d.hoursStart === "string" && HM.test(d.hoursStart)) out.hoursStart = d.hoursStart;
  if (typeof d.hoursEnd === "string" && HM.test(d.hoursEnd)) out.hoursEnd = d.hoursEnd;
  if (typeof d.workingDays === "string" && d.workingDays.trim() && d.workingDays.length <= 60) {
    out.workingDays = d.workingDays.trim();
  }
  if (typeof d.timezone === "string" && isTimeZone(d.timezone)) out.timezone = d.timezone;
  for (const key of NOTIFY_KEYS) {
    if (typeof d[key] === "boolean") out[key] = d[key] as boolean;
  }
  return out;
}

/** A zone the runtime can actually format in; a half-typed one would throw on every render. */
export function isTimeZone(value: string): boolean {
  if (!/^[A-Za-z_]+(\/[A-Za-z_]+)+$/.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en-AU", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function withDefaults(partial: Partial<WorkspacePrefs> | undefined): WorkspacePrefs {
  return { ...DEFAULT_PREFS, ...(partial ?? {}) };
}
