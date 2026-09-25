import { format } from "date-fns";
import { enAU } from "date-fns/locale";
import { addCalendarDays, startOfDay, wallNow } from "@/domain/format";

export type SignatureScene = "form" | "text";

export type SignatureFact = {
  id: string;
  label: string;
  value: string;
  from?: string;
};

export type SignatureCheck = {
  id: string;
  label: string;
  value: string;
  /**
   * ok: satisfied ("Clear"). check: holds only after something is checked
   * ("Check first"). warn: possible with a condition ("Condition"). block:
   * rules the request, or part of it, out ("Rules it out"). quiet: noted.
   */
  tone: "ok" | "check" | "warn" | "block" | "quiet";
  changed?: boolean;
  why?: string;
};

export type SignatureState = {
  scene: SignatureScene;
  channel: string;
  at: string;
  message: string;
  want: string;
  facts: SignatureFact[];
  checks: SignatureCheck[];
  /** Plain Yes / No / Not yet call, truthfully read off nextAction and the checks below. */
  verdict: string;
  nextAction: string;
  nextReason: string;
  commercialNote: string;
  link?: { label: string; reason: string };
};

/** Tom's active Ridge capacity rule. Demo copy must stay grounded in this body. */
export const RIDGE_CREW_WINDOW_RULE = {
  id: "rd-crew-window",
  title: "Empty-house crew window",
  body: "A two-person weekday crew can finish up to four standard bedrooms plus living areas in a five-weekday empty-house window. That crew-size call is provisional until the living areas are measured. Adding ceilings, or compressing the window to three weekdays or fewer, needs the third contractor (48 hours notice). Living areas are still quoted on measure.",
  sourceLabel: "Tom",
} as const;

/**
 * The dates behind the signature demo, computed from `now` instead of frozen
 * on the day the copy was written - the same problem `src/fixtures/relative-dates.ts`
 * solves for the sample workspace, but this story has no ISO-timestamped
 * fixtures to shift: every date only ever existed as prose, so it is computed
 * fresh each time from a handful of day/week offsets and rendered as words.
 *
 * `emptyFrom` anchors the story: it is always the next Monday at least three
 * weeks out from `now`, which keeps "empty from Monday the 14th" a genuine
 * Monday for any `now` and keeps the crew-window arithmetic below intact
 * (Mon->Fri is five weekdays, Mon->Wed is three) regardless of month or year.
 */
export type SignatureDates = {
  arrivalForm: Date;
  arrivalText: Date;
  emptyFrom: Date;
  deadlineForm: Date;
  deadlineText: Date;
};

const DAYS_SINCE_FORM_ARRIVED = 3;
const WEEKS_UNTIL_EMPTY_HOUSE = 3;

function mondayOnOrAfter(d: Date): Date {
  const MONDAY = 1;
  return addCalendarDays(d, (MONDAY - d.getDay() + 7) % 7);
}

export function buildSignatureDates(now: Date = new Date()): SignatureDates {
  const today = startOfDay(wallNow(now));
  const arrivalForm = addCalendarDays(today, -DAYS_SINCE_FORM_ARRIVED);
  const arrivalText = addCalendarDays(arrivalForm, 1);
  const emptyFrom = mondayOnOrAfter(addCalendarDays(today, WEEKS_UNTIL_EMPTY_HOUSE * 7));
  // Five weekdays, Mon-Fri: the crew-window rule's full window.
  const deadlineForm = addCalendarDays(emptyFrom, 4);
  // Three weekdays, Mon-Wed: the compressed window the rule calls out by name.
  const deadlineText = addCalendarDays(emptyFrom, 2);
  return { arrivalForm, arrivalText, emptyFrom, deadlineForm, deadlineText };
}

function formatArrivalAt(d: Date, time: string): string {
  return `${format(d, "EEE d MMM", { locale: enAU })}, ${time}`;
}

/** "Monday the 14th" - a weekday name paired with its own ordinal day. */
function formatWeekdayThe(d: Date): string {
  return format(d, "EEEE 'the' do", { locale: enAU });
}

function formatShortDate(d: Date): string {
  return format(d, "d MMM", { locale: enAU });
}

function formatLongDate(d: Date): string {
  return format(d, "d MMMM", { locale: enAU });
}

/**
 * Plain questions for the demo's "Why this step?" rows. Demo-only: the app's
 * own check labels live in src/domain/labels.ts and are not changed here.
 */
const CHECK_LABELS = {
  eligibility: "Do we do this job?",
  scope: "Size of job",
  capacity: "Crew",
} as const;

type SignatureDemoContent = {
  business: string;
  owner: string;
  customer: string;
  phone: string;
  headline: string;
  supporting: string;
  takeaway: string;
  form: SignatureState;
  text: SignatureState;
  /** "16th": the day the text scene moves the deadline to, for the copy that names it. */
  textDeadlineDay: string;
};

/**
 * The signature demo, built fresh from `now`. Message prose, the "at"
 * timestamps and the scope/access/deadline facts are all derived from the
 * same `SignatureDates`, so the arrival, the empty-house Monday and the two
 * deadlines can never drift out of sync with each other.
 */
export function buildSignatureDemo(now: Date = new Date()): SignatureDemoContent {
  const dates = buildSignatureDates(now);
  const textDeadlineDay = format(dates.deadlineText, "do", { locale: enAU });

  const form: SignatureState = {
    scene: "form",
    channel: "Website form",
    at: formatArrivalAt(dates.arrivalForm, "9:14am"),
    message: `Hi, we settle on a four-bedroom place in New Farm on ${formatLongDate(dates.deadlineForm)}. It’s empty from ${formatWeekdayThe(dates.emptyFrom)}. We’d like the bedrooms and living areas painted before we move in. Is that doable?`,
    want: "Interior painting · 4 bedrooms + living · New Farm",
    facts: [
      { id: "scope", label: "Scope", value: "4 bedrooms + living areas" },
      { id: "access", label: "Access", value: `Empty from ${formatShortDate(dates.emptyFrom)}` },
      { id: "deadline", label: "Deadline", value: formatShortDate(dates.deadlineForm) },
    ],
    checks: [
      { id: "eligibility", label: CHECK_LABELS.eligibility, value: "Yes", tone: "ok" },
      {
        id: "scope",
        label: CHECK_LABELS.scope,
        value: "Living areas need a measure before a final quote",
        tone: "check",
      },
      {
        id: "capacity",
        label: CHECK_LABELS.capacity,
        value: "A two-person crew fits it, to be confirmed after the measure",
        tone: "check",
        why: RIDGE_CREW_WINDOW_RULE.body,
      },
    ],
    verdict: "Not yet - measure first",
    nextAction: "Offer a site measure",
    nextReason:
      "The current window looks like a two-person job, but the living areas need measuring before a final quote can be confirmed.",
    commercialNote: "Final quote follows site measure.",
  };

  const text: SignatureState = {
    scene: "text",
    channel: "Text message",
    at: formatArrivalAt(dates.arrivalText, "7:22am"),
    message: `Hey, Maya from the website form. Settlement has moved forward - could we have it finished by ${formatWeekdayThe(dates.deadlineText)} instead? And we’d like the ceilings done too.`,
    want: "Interior painting · 4 bedrooms + living + ceilings · New Farm",
    facts: [
      {
        id: "scope",
        label: "Scope",
        value: "4 bedrooms + living areas + ceilings",
        from: "4 bedrooms + living areas",
      },
      { id: "access", label: "Access", value: `Empty from ${formatShortDate(dates.emptyFrom)}` },
      {
        id: "deadline",
        label: "Deadline",
        value: formatShortDate(dates.deadlineText),
        from: formatShortDate(dates.deadlineForm),
      },
    ],
    checks: [
      { id: "eligibility", label: CHECK_LABELS.eligibility, value: "Yes", tone: "ok" },
      {
        id: "scope",
        label: CHECK_LABELS.scope,
        value: "Living areas still need a measure",
        tone: "check",
      },
      {
        id: "capacity",
        label: CHECK_LABELS.capacity,
        value: "Yes, on one condition: the third contractor (48 hours notice)",
        tone: "warn",
        changed: true,
        why: RIDGE_CREW_WINDOW_RULE.body,
      },
    ],
    verdict: `Yes by the ${textDeadlineDay}, if the third contractor is free`,
    nextAction: "Confirm the extra crew, then keep the site measure",
    nextReason:
      "Book the third contractor (48 hours notice) before you confirm. The price stays open until the site measure.",
    commercialNote: "Final quote follows site measure.",
    link: {
      label: "Linked to Maya’s existing enquiry",
      reason: "Same mobile number as the website form.",
    },
  };

  return {
    business: "Sample business · Ridge & Co Painting",
    owner: "Tom Ridge",
    customer: "Maya Chen",
    phone: "0491 570 006",
    headline: "One enquiry. Even when the conversation moves.",
    supporting:
      "A form becomes a text. The scope changes. Enquiry keeps the request, the business checks and the next action current.",
    takeaway:
      "Enquiry doesn’t just keep the messages together. It keeps the business decision current.",
    form,
    text,
    textDeadlineDay,
  };
}

/**
 * Computed once at module load, from the real current time, so every
 * existing consumer that reads `SIGNATURE_DEMO.form.at` (etc.) as a plain
 * value keeps working unchanged. Tests that need a fixed `now` should call
 * `buildSignatureDemo(now)` directly instead of reading this constant.
 */
export const SIGNATURE_DEMO = buildSignatureDemo();

export type SignatureBusinessId = "ridge" | "harbour";

/**
 * Priya's rule at the second sample business. Same trade, different reality:
 * one painter, no ceilings, and a scope that needs the whole window.
 */
export const HARBOUR_SOLO_RULE = {
  id: "hb-solo-window",
  title: "Solo painter, walls only",
  body: "Priya paints alone. Four standard bedrooms plus living areas take the full five weekdays of an empty-house window. Ceilings are not offered; customers who want them are referred to a partner. A window shorter than five weekdays for that scope is declined, with the next available start offered instead.",
  sourceLabel: "Priya",
} as const;

export type SignatureBusiness = {
  id: SignatureBusinessId;
  label: string;
  detail: string;
  owner: string;
  rule: { id: string; title: string; body: string; sourceLabel: string };
  form: SignatureState;
  text: SignatureState;
};

/**
 * The signature demonstration (research doc 37): the same customer message
 * producing two different correct answers at two businesses, then one changed
 * fact moving each answer for its own reasons.
 *
 * Harbour's form/text reuse Ridge's message, "at" and facts verbatim (only
 * the checks/verdict/next-action differ), so both businesses always agree on
 * what day the empty-house Monday and the two deadlines are.
 */
export function buildSignatureBusinesses(
  demo: SignatureDemoContent = SIGNATURE_DEMO,
): SignatureBusiness[] {
  const harbourForm: SignatureState = {
    ...demo.form,
    checks: [
      { id: "eligibility", label: CHECK_LABELS.eligibility, value: "Yes", tone: "ok" },
      {
        id: "scope",
        label: CHECK_LABELS.scope,
        value: "Living areas need a measure before a final quote",
        tone: "check",
      },
      {
        id: "capacity",
        label: CHECK_LABELS.capacity,
        value: "One painter fits it exactly, using all five weekdays",
        tone: "ok",
        why: HARBOUR_SOLO_RULE.body,
      },
    ],
    verdict: "Not yet - measure first, hold the week",
    nextAction: "Offer a site measure and hold the full week",
    nextReason:
      "Alone, this scope needs every weekday in the window. Measure first so the quote is real, and keep the week clear.",
  };

  const harbourText: SignatureState = {
    ...demo.text,
    checks: [
      {
        id: "eligibility",
        label: CHECK_LABELS.eligibility,
        value: "Walls yes. Ceilings are not offered here, so they go to a partner",
        tone: "block",
        changed: true,
        why: HARBOUR_SOLO_RULE.body,
      },
      {
        id: "scope",
        label: CHECK_LABELS.scope,
        value: "Living areas still need a measure",
        tone: "check",
      },
      {
        id: "capacity",
        label: CHECK_LABELS.capacity,
        value: "Not possible: one painter needs five weekdays, and this is three",
        tone: "block",
        changed: true,
        why: HARBOUR_SOLO_RULE.body,
      },
    ],
    verdict: `No to the ${demo.textDeadlineDay} - offer the next full week`,
    nextAction: `Say no to the ${demo.textDeadlineDay}, offer the next full week, refer the ceilings`,
    nextReason:
      "Same conversation, different business. Alone, the shorter window cannot fit four bedrooms plus living, and ceilings are not something Harbour does. The honest reply offers what is possible.",
    commercialNote: "No quote for work that cannot be done in the window.",
  };

  return [
    {
      id: "ridge",
      label: "Ridge & Co Painting",
      detail: "Two-person crew, a third contractor on 48 hours notice",
      owner: demo.owner,
      rule: RIDGE_CREW_WINDOW_RULE,
      form: demo.form,
      text: demo.text,
    },
    {
      id: "harbour",
      label: "Harbour Painting",
      detail: "One painter, walls only, ceilings referred out",
      owner: "Priya Nair",
      rule: HARBOUR_SOLO_RULE,
      form: harbourForm,
      text: harbourText,
    },
  ];
}

export const SIGNATURE_BUSINESSES = buildSignatureBusinesses(SIGNATURE_DEMO);

export function signatureBusiness(
  id: SignatureBusinessId,
  businesses: readonly SignatureBusiness[] = SIGNATURE_BUSINESSES,
): SignatureBusiness {
  return businesses.find((b) => b.id === id) ?? businesses[0]!;
}

export function signatureState(
  scene: SignatureScene,
  business: SignatureBusinessId = "ridge",
  businesses: readonly SignatureBusiness[] = SIGNATURE_BUSINESSES,
): SignatureState {
  const b = signatureBusiness(business, businesses);
  return scene === "text" ? b.text : b.form;
}

export function signatureChangedFactIds(from: SignatureState, to: SignatureState): string[] {
  return to.facts
    .filter((fact) => {
      const prior = from.facts.find((f) => f.id === fact.id);
      return Boolean(fact.from || (prior && prior.value !== fact.value));
    })
    .map((f) => f.id);
}
