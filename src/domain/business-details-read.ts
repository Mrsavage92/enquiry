import {
  readDetailLine,
  readWorkingHours,
  type AnswerDetail,
  type DetailRead,
} from "./business-detail.ts";
import { answerTopicOf } from "./customer-asks.ts";
import {
  extraOnly,
  readPriceLine,
  splitLines,
  thresholdOnly,
  type PriceSentences,
  type UnreadLine,
} from "./price-sentence.ts";
import { pluraliseUnit } from "./business-rule.ts";
import { readRuleLine } from "./business-rules-read.ts";

/**
 * Everything an owner wrote in "Add a business detail", sorted: prices it can
 * quote, rules that are not prices ("We don't work Sundays", "We don't do
 * mould removal"), and lines it will not save as a price, each with the reason
 * (a conditional price or fee carries `note` so it can be kept as a note).
 */
export type BusinessDetailsRead = PriceSentences & { details: DetailRead[] };

/** A dollar amount written as "$65" or "65 dollars". */
const HAS_AMOUNT = /\$\s?\d|\d\s*(?:dollars?|bucks)\b/i;

const NOT_A_PRICE =
  "There is no price in it, and Enquiry did not read it as a rule it can check on a quote.";

/**
 * "Regular house clean $160 for up to 3 bedrooms" on one line and "Extra
 * bedrooms $35 each" on the next are one price: joined, so the threshold is
 * never dropped. A threshold with nothing for the ones after it, or an "extra"
 * price with no threshold to follow, is refused with the reason - saving
 * either alone would under-quote the bigger job.
 */
function joinTiers(lines: string[]): { lines: string[]; refused: UnreadLine[] } {
  const out: string[] = [];
  const refused: UnreadLine[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    const threshold = thresholdOnly(line);
    const next = lines[i + 1];
    const extra = next ? extraOnly(next) : null;
    if (threshold && extra && extra.unit === threshold.unit) {
      out.push(
        `${line.replace(/[.;,]+\s*$/, "")}, extra ${pluraliseUnit(extra.unit, 2)} $${extra.amount} each`,
      );
      i += 1;
      continue;
    }
    if (threshold) {
      refused.push({
        line,
        reason: `It covers up to ${threshold.count} ${pluraliseUnit(threshold.unit, threshold.count)}, but not what each ${threshold.unit} after that costs, so a bigger job would be under-quoted. Add it to the same line, for example: ${TIER_EXAMPLE}.`,
      });
      continue;
    }
    const alone = extraOnly(line);
    if (alone) {
      const before = out.length ? out[out.length - 1] : undefined;
      if (before && HAS_AMOUNT.test(before) && !readRuleLine(before)) {
        out.pop();
        refused.push({
          line: before,
          reason: `The next line adds a price for extra ${pluraliseUnit(alone.unit, 2)}, but this one does not say how many ${pluraliseUnit(alone.unit, 2)} it covers. Write both on one line, for example: ${TIER_EXAMPLE}.`,
        });
      }
      refused.push({
        line,
        reason: `It is a price for extra ${pluraliseUnit(alone.unit, 2)}, but no price says how many ${pluraliseUnit(alone.unit, 2)} come before the extra ones. Write both on one line, for example: ${TIER_EXAMPLE}.`,
      });
      continue;
    }
    out.push(line);
  }
  return { lines: out, refused };
}

const TIER_EXAMPLE = "House clean $160 for up to 3 bedrooms, extra bedrooms $35 each";

/** A day of the week, a date or a holiday: what a closed-days line is about. */
const DAY_OR_DATE =
  /\b(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\b|\bweekends?\b|\b\d{1,2}(?:st|nd|rd|th)?\s*(?:-|–|to\s+\d)?|\b(?:christmas|xmas|boxing|new\s+year|anzac|australia\s+day)\b/i;
/** Words that say the owner is not working. */
const OFF_WORDS =
  /\b(?:don'?t|do not|never|not|no|closed|away|unavailable|off|shut|booked|on leave|holidays?)\b/i;

/**
 * "We don't work Saturdays and we're away 20-27 Dec", "Not available Saturday
 * 10 October or Sunday 11 October": several days in one line, split so each
 * is read. A part with only a day in it takes the first part's words ("Not
 * available"). Only for lines about days and dates, with no price in them.
 */
function dayParts(line: string): string[] {
  if (HAS_AMOUNT.test(line) || !DAY_OR_DATE.test(line)) return [line];
  const parts = line
    .split(/\s*(?:;|,|\band\b|\bor\b)\s*/i)
    .map((p) => p.trim())
    .filter((p) => /[a-z0-9]/i.test(p));
  if (parts.length < 2) return [line];
  const first = parts[0]!;
  const at = first.search(DAY_OR_DATE);
  const lead = at > 0 ? first.slice(0, at) : "";
  return parts.map((p, i) =>
    i > 0 && lead && !OFF_WORDS.test(p) && onlyDays(p) ? `${lead}${p}` : p,
  );
}

type LineRead = Pick<BusinessDetailsRead, "prices" | "unread" | "details">;

/** One part of a line, read the way a whole line is. */
function readPart(line: string, now: Date): LineRead {
  const out: LineRead = { prices: [], unread: [], details: [] };
  // "Mon-Sat 7am-5pm": the hours Settings keeps, read back before saving.
  const hours = readWorkingHours(line);
  if (hours) {
    out.details.push({ line, detail: hours });
    return out;
  }
  // A minimum, surcharge, fee, "only if" or closed dates: a rule each quote
  // it concerns checks with one tap, not a note the owner has to remember.
  const rule = readRuleLine(line, now);
  if (rule?.refuse) {
    out.unread.push({ line, reason: rule.refuse });
    return out;
  }
  if (rule?.note) {
    out.unread.push({ line, reason: rule.note, note: true });
    return out;
  }
  if (rule) {
    const price = rule.priceLine ? readPriceLine(rule.priceLine) : null;
    if (price && !("rule" in price)) {
      out.unread.push({ ...price, line });
      return out;
    }
    const service = price && "rule" in price ? price.rule.service : undefined;
    if (price && "rule" in price) out.prices.push({ ...price, line });
    for (const part of rule.remainder ?? []) {
      out.unread.push({ line: part, reason: NOT_A_PRICE, note: true });
    }
    for (const detail of rule.details) {
      const tied =
        detail.kind === "minimum_charge" && !detail.service && service
          ? { ...detail, service }
          : detail;
      out.details.push({ line, detail: tied });
    }
    return out;
  }
  const detail = readDetailLine(line);
  if (detail && "refuse" in detail) {
    out.unread.push({ line, reason: detail.refuse });
    return out;
  }
  if (detail) {
    out.details.push({ line, detail });
    return out;
  }
  const read = readPriceLine(line);
  if ("rule" in read) {
    out.prices.push(read);
    // "Doors $90 each (includes frame)": the price, and a note on what it covers.
    if (read.note) {
      const service = read.rule.service;
      out.details.push({
        line,
        detail: { kind: "note", text: `${service} includes ${read.note}`, service },
      });
    }
  } else if (answerFor(line)) {
    // "We have $20 million public liability insurance": the owner's answer to
    // a question customers ask, offered when one does - never a price.
    out.details.push({ line, detail: answerFor(line)! });
  } else if (HAS_AMOUNT.test(line)) out.unread.push(read);
  else out.unread.push({ line, reason: NOT_A_PRICE, note: true });
  return out;
}

/**
 * The owner's sentence as a saved answer, when it answers a question customers
 * ask: "Do you have insurance? Yes, $20 million public liability." keeps their
 * question; "We bring our own equipment" gets the usual one.
 */
function answerFor(line: string): AnswerDetail | null {
  const read = answerTopicOf(line);
  if (!read) return null;
  const qa = /^\s*(.+?\?)\s*(.+?)\s*$/.exec(line);
  // Said as the owner's own answer: a question and its answer, "we ..." /
  // "yes ...", or insurance and licensing, which are only ever about them.
  // "Cash only for jobs" and "No pets inside" stay notes.
  const own =
    Boolean(qa) ||
    /^\s*(?:we|we're|we've|our|i|i'm|i've|my|yes|yep|all\s+(?:our|my))\b/i.test(line) ||
    read.topic === "insurance" ||
    read.topic === "licence";
  if (!own) return null;
  const question = qa ? qa[1]!.trim() : read.question;
  const text = (qa ? qa[2]! : line).trim().replace(/[;]+$/, "");
  if (!text || text.length > 300) return null;
  return {
    kind: "answer",
    topic: read.topic,
    question,
    text: /[.!?]$/.test(text) ? text : `${text}.`,
  };
}

/**
 * A whole line: split into its days when it names several, and saved only
 * when every part reads - never one part quietly dropped.
 */
function readLine(line: string, now: Date): LineRead {
  const parts = dayParts(line);
  if (parts.length === 1) return readPart(line, now);
  const reads = parts.map((p) => readPart(p, now));
  const readable = reads.filter(
    (r) => r.prices.length + r.details.length > 0 && r.unread.length === 0,
  );
  // Nothing in it reads as days: read as one line, the way it always was.
  if (readable.length === 0) return readPart(line, now);
  if (readable.length === reads.length) {
    return {
      prices: reads.flatMap((r) => r.prices.map((p) => ({ ...p, line }))),
      details: reads.flatMap((r) => r.details.map((d) => ({ ...d, line }))),
      unread: [],
    };
  }
  const said = reads
    .flatMap((r, i) => (readable.includes(r) ? [parts[i]!] : []))
    .map((p) => `"${p}"`)
    .join(", ");
  return {
    prices: [],
    details: [],
    unread: [
      {
        line,
        reason: `Enquiry read ${readable.length} of ${parts.length} parts${said ? ` (${said})` : ""}. Write each on its own line so none is dropped.`,
      },
    ],
  };
}

export function readBusinessDetails(text: string, now: Date = new Date()): BusinessDetailsRead {
  const out: BusinessDetailsRead = { prices: [], unread: [], details: [] };
  const joined = joinTiers(splitLines(text));
  out.unread.push(...joined.refused);
  for (const line of joined.lines) {
    const read = readLine(line, now);
    out.prices.push(...read.prices);
    out.details.push(...read.details);
    out.unread.push(...read.unread);
  }
  return out;
}

/** "Sunday 11 October", "Sundays", "the 12th": a part that is nothing but a day. */
function onlyDays(part: string): boolean {
  const rest = part
    .toLowerCase()
    .replace(
      /\b(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\b|\bweekends?\b|\b\d{1,2}(?:st|nd|rd|th)?\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\b(?:the|on|of|every|to|-|–)\b/g,
      " ",
    )
    .replace(/[^a-z]+/g, " ")
    .trim();
  return rest === "";
}
