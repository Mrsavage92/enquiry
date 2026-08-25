import { format, formatDistanceToNow, parseISO } from "date-fns";
import { enAU } from "date-fns/locale";

export { channelLabel, identityLine, replyChannel, replyTo, isShortChannel, threadLabel } from "./channel";

/** Wall-clock from the timestamp, ignoring the viewer's zone. */
export function wallDate(iso: string): Date {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return parseISO(iso);
  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6] ?? 0),
  );
}

export function dayKeyFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function dayKeyFromIso(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  return dayKeyFromDate(wallDate(iso));
}

export function dateFromDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function formatWhen(iso: string): string {
  try {
    return format(wallDate(iso), "d MMM yyyy, h:mmaaa", { locale: enAU });
  } catch {
    return iso;
  }
}

export function formatShortDate(iso: string): string {
  try {
    return format(wallDate(iso), "d MMM yyyy", { locale: enAU });
  } catch {
    return iso;
  }
}

export function formatRelative(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: enAU });
  } catch {
    return iso;
  }
}

export function formatTime(iso: string): string {
  try {
    return format(wallDate(iso), "h:mmaaa", { locale: enAU });
  } catch {
    return iso;
  }
}

export function formatTimeRange(startIso: string, endIso: string): string {
  return `${formatTime(startIso)}–${formatTime(endIso)}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
}

export function formatDayHeading(keyOrIso: string, now = wallNow()): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(keyOrIso) ? dateFromDayKey(keyOrIso) : wallDate(keyOrIso);
  const key = dayKeyFromDate(d);
  const today = dayKeyFromDate(now);
  const tomorrow = dayKeyFromDate(addCalendarDays(now, 1));
  const label = format(d, "EEE d MMM", { locale: enAU });
  if (key === today) return `Today · ${label}`;
  if (key === tomorrow) return `Tomorrow · ${label}`;
  return label;
}

export function formatWeekdayShort(d: Date): string {
  return format(d, "EEEEE", { locale: enAU });
}

export function formatWeekdayMed(d: Date): string {
  return format(d, "EEE", { locale: enAU });
}

export function addCalendarDays(d: Date, days: number): Date {
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
  return next;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function isoOffset(iso: string): string {
  const m = iso.match(/([Zz]|[+-]\d{2}:\d{2})$/);
  if (!m) return "";
  return m[1] === "Z" || m[1] === "z" ? "Z" : m[1];
}

export function wallIso(d: Date, offset = ""): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${offset}`;
}

export function addMinutesToIso(iso: string, minutes: number): string {
  const d = wallDate(iso);
  d.setMinutes(d.getMinutes() + minutes);
  return wallIso(d, isoOffset(iso));
}

export function hmFromIso(iso: string): string {
  const d = wallDate(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function wallNow(now = new Date(), timeZone = "Australia/Brisbane"): Date {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return new Date(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
}

export function todayKey(now = new Date(), timeZone = "Australia/Brisbane"): string {
  return dayKeyFromDate(wallNow(now, timeZone));
}

export function isoFromDayAndTime(dayKey: string, hm: string, offset = "+10:00"): string {
  const [h, min] = hm.split(":").map(Number);
  const d = dateFromDayKey(dayKey);
  d.setHours(h || 0, min || 0, 0, 0);
  return wallIso(d, offset);
}
