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
  nextAction: string;
  nextReason: string;
  commercialNote: string;
  link?: { label: string; reason: string };
};

export const SIGNATURE_DEMO = {
  business: "Ridge & Co Painting",
  owner: "Tom Ridge",
  customer: "Maya Chen",
  phone: "0412 880 441",
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
        value: "Feasible with the two-person weekday crew",
        tone: "ok",
      },
    ],
    nextAction: "Offer a site measure",
    nextReason:
      "The current scope fits the crew window, but the living areas need measuring before a final quote can be confirmed.",
    commercialNote: "Final quote follows site measure.",
  } satisfies SignatureState,
  text: {
    scene: "text",
    channel: "Text message",
    at: "Wed 26 Aug, 7:22am",
    message:
      "Hey, Maya from the website form. Settlement has moved forward — could we have it finished by Wednesday the 16th instead? And we’d like the ceilings done too.",
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
        value: "Feasible with condition — third contractor required",
        tone: "warn",
        changed: true,
        why: "Standard weekday crew: two painters. A third contractor can be booked with 48 hours notice.",
      },
    ],
    nextAction: "Confirm the extra crew option and keep the site measure",
    nextReason:
      "The earlier deadline plus ceilings changes the crew requirement. Ridge & Co can still make it work if the third contractor is secured in time.",
    commercialNote: "Final quote follows site measure.",
    link: {
      label: "Linked to Maya’s existing enquiry",
      reason: "Same mobile number as the website form.",
    },
  } satisfies SignatureState,
};

export function signatureState(scene: SignatureScene): SignatureState {
  return scene === "text" ? SIGNATURE_DEMO.text : SIGNATURE_DEMO.form;
}

export function signatureChangedFactIds(
  from: SignatureState,
  to: SignatureState,
): string[] {
  return to.facts.filter((fact) => {
    const prior = from.facts.find((f) => f.id === fact.id);
    return Boolean(fact.from || (prior && prior.value !== fact.value));
  }).map((f) => f.id);
}
