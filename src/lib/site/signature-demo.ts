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
  tone: "ok" | "warn" | "quiet";
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

export const SIGNATURE_DEMO = {
  business: "Sample business · Ridge & Co Painting",
  owner: "Tom Ridge",
  customer: "Maya Chen",
  phone: "0491 570 006",
  headline: "One enquiry. Even when the conversation moves.",
  supporting:
    "A form becomes a text. The scope changes. Enquiry keeps the request, the business checks and the next action current.",
  takeaway:
    "Enquiry doesn’t just keep the messages together. It keeps the business decision current.",
  form: {
    scene: "form",
    channel: "Website form",
    at: "Tue 25 Aug, 9:14am",
    message:
      "Hi, we settle on a four-bedroom place in New Farm on 18 September. It’s empty from Monday the 14th. We’d like the bedrooms and living areas painted before we move in. Is that doable?",
    want: "Interior painting · 4 bedrooms + living · New Farm",
    facts: [
      { id: "scope", label: "Scope", value: "4 bedrooms + living areas" },
      { id: "access", label: "Access", value: "Empty from 14 Sep" },
      { id: "deadline", label: "Deadline", value: "18 Sep" },
    ],
    checks: [
      { id: "eligibility", label: "Eligibility", value: "Offered", tone: "ok" },
      {
        id: "scope",
        label: "Scope",
        value: "Living areas need a measure before a final quote",
        tone: "quiet",
      },
      {
        id: "capacity",
        label: "Capacity",
        value: "Provisional - two-person crew can cover this window",
        tone: "ok",
        why: RIDGE_CREW_WINDOW_RULE.body,
      },
    ],
    verdict: "Not yet - measure first",
    nextAction: "Offer a site measure",
    nextReason:
      "The current window looks like a two-person job, but the living areas need measuring before a final quote can be confirmed.",
    commercialNote: "Final quote follows site measure.",
  } satisfies SignatureState,
  text: {
    scene: "text",
    channel: "Text message",
    at: "Wed 26 Aug, 7:22am",
    message:
      "Hey, Maya from the website form. Settlement has moved forward - could we have it finished by Wednesday the 16th instead? And we’d like the ceilings done too.",
    want: "Interior painting · 4 bedrooms + living + ceilings · New Farm",
    facts: [
      {
        id: "scope",
        label: "Scope",
        value: "4 bedrooms + living areas + ceilings",
        from: "4 bedrooms + living areas",
      },
      { id: "access", label: "Access", value: "Empty from 14 Sep" },
      { id: "deadline", label: "Deadline", value: "16 Sep", from: "18 Sep" },
    ],
    checks: [
      { id: "eligibility", label: "Eligibility", value: "Offered", tone: "quiet" },
      {
        id: "scope",
        label: "Scope",
        value: "Living areas still need a measure",
        tone: "quiet",
      },
      {
        id: "capacity",
        label: "Capacity",
        value: "Feasible with condition - third contractor required",
        tone: "warn",
        changed: true,
        why: RIDGE_CREW_WINDOW_RULE.body,
      },
    ],
    verdict: "Yes, with a condition",
    nextAction: "Confirm the extra crew option and keep the site measure",
    nextReason:
      "The earlier deadline plus ceilings needs the third contractor. Keep the site measure - the quote still isn’t final until then.",
    commercialNote: "Final quote follows site measure.",
    link: {
      label: "Linked to Maya’s existing enquiry",
      reason: "Same mobile number as the website form.",
    },
  } satisfies SignatureState,
};

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

const HARBOUR_FORM: SignatureState = {
  ...SIGNATURE_DEMO.form,
  checks: [
    { id: "eligibility", label: "Eligibility", value: "Offered", tone: "ok" },
    {
      id: "scope",
      label: "Scope",
      value: "Living areas need a measure before a final quote",
      tone: "quiet",
    },
    {
      id: "capacity",
      label: "Capacity",
      value: "Fits exactly - five weekdays for this scope, working alone",
      tone: "ok",
      why: HARBOUR_SOLO_RULE.body,
    },
  ],
  verdict: "Not yet - measure first, hold the week",
  nextAction: "Offer a site measure and hold the full week",
  nextReason:
    "Alone, this scope needs every weekday in the window. Measure first so the quote is real, and keep the week clear.",
};

const HARBOUR_TEXT: SignatureState = {
  ...SIGNATURE_DEMO.text,
  checks: [
    {
      id: "eligibility",
      label: "Eligibility",
      value: "Ceilings are not offered here - partner referral",
      tone: "warn",
      changed: true,
      why: HARBOUR_SOLO_RULE.body,
    },
    {
      id: "scope",
      label: "Scope",
      value: "Living areas still need a measure",
      tone: "quiet",
    },
    {
      id: "capacity",
      label: "Capacity",
      value: "Not possible - three weekdays is short of the five this scope needs solo",
      tone: "warn",
      changed: true,
      why: HARBOUR_SOLO_RULE.body,
    },
  ],
  verdict: "No to the 16th - offer the next full week",
  nextAction: "Say no to the 16th, offer the next full week, refer the ceilings",
  nextReason:
    "Same message, different business. Alone, the shorter window cannot fit four bedrooms plus living, and ceilings are not something Harbour does. The honest reply offers what is possible.",
  commercialNote: "No quote for work that cannot be done in the window.",
};

/**
 * The signature demonstration (research doc 37): the same customer message
 * producing two different correct answers at two businesses, then one changed
 * fact moving each answer for its own reasons.
 */
export const SIGNATURE_BUSINESSES = [
  {
    id: "ridge",
    label: "Ridge & Co Painting",
    detail: "Two-person crew, a third contractor on 48 hours notice",
    owner: SIGNATURE_DEMO.owner,
    rule: RIDGE_CREW_WINDOW_RULE,
    form: SIGNATURE_DEMO.form,
    text: SIGNATURE_DEMO.text,
  },
  {
    id: "harbour",
    label: "Harbour Painting",
    detail: "One painter, walls only, ceilings referred out",
    owner: "Priya Nair",
    rule: HARBOUR_SOLO_RULE,
    form: HARBOUR_FORM,
    text: HARBOUR_TEXT,
  },
] as const satisfies readonly {
  id: SignatureBusinessId;
  label: string;
  detail: string;
  owner: string;
  rule: { id: string; title: string; body: string; sourceLabel: string };
  form: SignatureState;
  text: SignatureState;
}[];

export function signatureBusiness(id: SignatureBusinessId) {
  return SIGNATURE_BUSINESSES.find((b) => b.id === id) ?? SIGNATURE_BUSINESSES[0];
}

export function signatureState(
  scene: SignatureScene,
  business: SignatureBusinessId = "ridge",
): SignatureState {
  const b = signatureBusiness(business);
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
