import type { BusinessDetail } from "./business-detail.ts";

/**
 * Owner sentences that are rules about money or eligibility, read into rules a
 * quote can check: "minimum charge $450", "Saturday jobs cost 20% more",
 * "Travel fee $40 outside Brisbane northside", "Exterior painting only if
 * single storey", "Closed 24 Dec - 2 Jan".
 *
 * Only the unambiguous shapes are read. Anything looser returns null and is
 * offered as a note instead, exactly as before - a rule Enquiry misread would
 * change a customer's total, which is worse than a note it shows the owner.
 *
 * A line with a price and a minimum ("Interior painting is $32 per square
 * metre, minimum charge $450") comes back with `priceLine`: the caller reads
 * the price from it and ties the minimum to that price's service.
 */
export type RuleLineRead = { details: BusinessDetail[]; priceLine?: string };

const AMOUNT = String.raw`\$\s?(\d[\d,]*(?:\.\d{1,2})?)`;
const ALL_AMOUNTS = /\$\s?\d/g;
const HAS_AMOUNT = /\$\s?\d/;
const MIN_WORD = String.raw`min(?:imum)?(?:\s+(?:charge|job|fee|call[- ]?out|callout|price))?`;

/** "..., minimum charge $450" after a price. */
const TRAILING_MIN = new RegExp(
  String.raw`^(.*\$\s?\d[^$]*?)[,;]?\s*(?:with\s+(?:a\s+)?|and\s+(?:a\s+)?|but\s+(?:a\s+)?)?${MIN_WORD}\s*(?:of|is|:|-)?\s*${AMOUNT}\s*[.!]?\s*$`,
  "i",
);
/** "Minimum charge for interior painting is $450", "Minimum call out $80". */
const MIN_FIRST = new RegExp(
  String.raw`^\s*(?:(?:our|a|the|my)\s+)?${MIN_WORD}\s*(?:(?:for|on)\s+(.+?))?\s*(?:is|of|:|-|=)?\s*${AMOUNT}\s*[.!]?\s*$`,
  "i",
);
/** "Interior painting minimum $450", "Oven clean $95 minimum". */
const MIN_AFTER_SERVICE = new RegExp(
  String.raw`^\s*(.+?)\s*[:-]?\s*(?:${MIN_WORD}\s*(?:is|of)?\s*${AMOUNT}|${AMOUNT}\s*${MIN_WORD})\s*[.!]?\s*$`,
  "i",
);

const DAY_WORDS: [RegExp, number][] = [
  [/\bsun(?:day)?s?\b/i, 0],
  [/\bmon(?:day)?s?\b/i, 1],
  [/\btue(?:s(?:day)?)?s?\b/i, 2],
  [/\bwed(?:nesday)?s?\b/i, 3],
  [/\bthu(?:r(?:s(?:day)?)?)?s?\b/i, 4],
  [/\bfri(?:day)?s?\b/i, 5],
  [/\bsat(?:urday)?s?\b/i, 6],
];

function daysIn(line: string): number[] {
  const days = new Set<number>();
  if (/\bweekends?\b/i.test(line)) [0, 6].forEach((d) => days.add(d));
  for (const [re, d] of DAY_WORDS) if (re.test(line)) days.add(d);
  return [...days].sort((a, b) => a - b);
}

const PERCENT = /(\d{1,3}(?:\.\d+)?)\s*%/;
const MORE = /\b(?:more|extra|surcharge|loading|on top|higher|dearer)\b|\+\s*\d/i;

const FEE_KINDS: [RegExp, string][] = [
  [/\btravel\b/i, "Travel fee"],
  [/\bcall[- ]?outs?\b|\bcallouts?\b/i, "Call-out fee"],
  [/\b(?:rubbish|tip|disposal)\b/i, "Disposal fee"],
  [/\bparking\b/i, "Parking fee"],
  [/\bbooking\b/i, "Booking fee"],
];
/** "extra $40 for ...", "$40 extra if ...": an amount added only in some cases. */
const EXTRA_FOR = new RegExp(
  String.raw`(?:\bextra\s+${AMOUNT}|${AMOUNT}\s+extra)\s+(?:for|if|when|outside|to|on)\b`,
  "i",
);

/** "We only do exterior painting on single storey homes". */
const ONLY_DO =
  /^\s*(?:we|i)\s+only\s+(?:do|offer|take on|paint)\s+(.+?)\s+(?:on|for|if|when|where)\s+(.+?)\s*[.!]*\s*$/i;
/** "Exterior painting only if single storey", "... only for single-storey houses". */
const SERVICE_ONLY =
  /^\s*(.+?)\s+only\s+(?:if|for|on|when|where)\s+(?:(?:the|it'?s|it\s+is)\s+)?(?:(?:house|home|job|property|place)\s+(?:is|are)\s+)?(.+?)\s*[.!]*\s*$/i;
const PLACE_TAIL = /\s+(?:homes?|houses?|properties|property|jobs?|places?|buildings?)$/i;

const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
] as const;
const MONTH = String.raw`(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)`;
const RANGE_WORDS = String.raw`\s*(?:-|–|to|until|till|through|thru)\s*`;
const WORDED_RANGE = new RegExp(
  String.raw`(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?${MONTH}${RANGE_WORDS}(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?${MONTH}`,
  "i",
);
const NUMERIC_RANGE = new RegExp(
  String.raw`\b(\d{1,2})\/(\d{1,2})${RANGE_WORDS}(\d{1,2})\/(\d{1,2})\b`,
  "i",
);
const CLOSED_WORDS =
  /\b(?:closed|away|off|not working|on leave|on holidays?|holidays?|shut|no jobs?|break)\b/i;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function monthDay(month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1) return null;
  if (day > new Date(2024, month, 0).getDate()) return null;
  return `${pad(month)}-${pad(day)}`;
}

function monthOf(word: string): number {
  return MONTHS.indexOf(word.slice(0, 3).toLowerCase() as (typeof MONTHS)[number]) + 1;
}

function amountOf(raw: string): number {
  return Number(raw.replace(/,/g, ""));
}

/** "interior painting" -> "Interior painting". */
function serviceName(raw: string | undefined): string | undefined {
  const s = (raw ?? "")
    .trim()
    .replace(/^(?:for|on|the|our|my)\s+/i, "")
    .replace(/\s+(?:is|are|jobs?)$/i, "")
    .replace(/[.,;:!-]+$/, "")
    .trim();
  if (!s || s.split(/\s+/).length > 5 || /\d|\$/.test(s)) return undefined;
  return s[0]!.toUpperCase() + s.slice(1);
}

function readMinimum(line: string): RuleLineRead | null {
  const amounts = (line.match(ALL_AMOUNTS) ?? []).length;
  if (!/\bmin(?:imum)?\b/i.test(line)) return null;
  if (amounts === 2) {
    const m = TRAILING_MIN.exec(line);
    if (!m) return null;
    return {
      details: [{ kind: "minimum_charge", amount: amountOf(m[2]!) }],
      priceLine: m[1]!.trim().replace(/[,;]+$/, ""),
    };
  }
  if (amounts !== 1) return null;
  const first = MIN_FIRST.exec(line);
  if (first) {
    const service = serviceName(first[1]);
    if (first[1] && !service) return null;
    return {
      details: [
        { kind: "minimum_charge", amount: amountOf(first[2]!), ...(service ? { service } : {}) },
      ],
    };
  }
  const after = MIN_AFTER_SERVICE.exec(line);
  const service = serviceName(after?.[1]);
  if (!after || !service) return null;
  return {
    details: [{ kind: "minimum_charge", amount: amountOf(after[2] ?? after[3]!), service }],
  };
}

function readSurcharge(line: string): RuleLineRead | null {
  const pct = PERCENT.exec(line);
  if (!pct || HAS_AMOUNT.test(line) || !MORE.test(line)) return null;
  const days = daysIn(line);
  if (days.length === 0 || days.length === 7) return null;
  if (/\b(?:off|discount|less|cheaper)\b/i.test(line)) return null;
  return { details: [{ kind: "surcharge", percent: Number(pct[1]), days }] };
}

function readFee(line: string): RuleLineRead | null {
  if ((line.match(ALL_AMOUNTS) ?? []).length !== 1) return null;
  const amount = new RegExp(AMOUNT).exec(line);
  if (!amount) return null;
  const kind = FEE_KINDS.find(([re]) => re.test(line));
  const isFee = /\bfees?\b/i.test(line) || Boolean(kind);
  if (!isFee && !EXTRA_FOR.test(line)) return null;
  if (/\bper\b|\/\s*[a-z]|\ban?\s+(?:hour|room|window|metre)/i.test(line)) return null;
  const text = line.trim().replace(/[.;]+$/, "");
  return {
    details: [
      { kind: "fee", amount: amountOf(amount[1]!), label: kind?.[1] ?? "Extra charge", text },
    ],
  };
}

function readEligibility(line: string): RuleLineRead | null {
  if (HAS_AMOUNT.test(line) || !/\bonly\b/i.test(line)) return null;
  const m = ONLY_DO.exec(line) ?? SERVICE_ONLY.exec(line);
  if (!m) return null;
  const service = serviceName(m[1]!.replace(/^(?:we|i)\s+(?:do\s+)?/i, ""));
  const condition = m[2]!.trim().replace(PLACE_TAIL, "").trim().toLowerCase();
  if (!service || !condition || condition.split(/\s+/).length > 6) return null;
  return {
    details: [{ kind: "eligibility", service, condition, text: line.trim().replace(/[.;]+$/, "") }],
  };
}

function readClosedDates(line: string): RuleLineRead | null {
  if (!CLOSED_WORDS.test(line) || HAS_AMOUNT.test(line)) return null;
  const worded = WORDED_RANGE.exec(line);
  if (worded) {
    const from = monthDay(monthOf(worded[2]!), Number(worded[1]));
    const to = monthDay(monthOf(worded[4]!), Number(worded[3]));
    return from && to ? { details: [{ kind: "closed_dates", from, to }] } : null;
  }
  const numeric = NUMERIC_RANGE.exec(line);
  if (!numeric) return null;
  const from = monthDay(Number(numeric[2]), Number(numeric[1]));
  const to = monthDay(Number(numeric[4]), Number(numeric[3]));
  return from && to ? { details: [{ kind: "closed_dates", from, to }] } : null;
}

/** A rule about money or eligibility, when the line is one; null otherwise. */
export function readRuleLine(line: string): RuleLineRead | null {
  const written = line
    .replace(/(\d[\d,]*(?:\.\d{1,2})?)\s*(?:dollars?|bucks|aud)\b/gi, "$$$1")
    .replace(/\b(?:aud|a\$)\s?(?=\d)/gi, "$$");
  return (
    readClosedDates(written) ??
    readMinimum(written) ??
    readSurcharge(written) ??
    readEligibility(written) ??
    readFee(written)
  );
}
