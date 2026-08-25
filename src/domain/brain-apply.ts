import type {
  BrainChangePreview,
  Business,
  Enquiry,
  KnowledgeItem,
} from "./types";
import { ACTION_LABELS, commercialValue, formatAud } from "./labels";
import { defaultHold } from "./commercial";

const MONTHS: Record<string, string> = {
  january: "01",
  jan: "01",
  february: "02",
  feb: "02",
  march: "03",
  mar: "03",
  april: "04",
  apr: "04",
  may: "05",
  june: "06",
  jun: "06",
  july: "07",
  jul: "07",
  august: "08",
  aug: "08",
  september: "09",
  sep: "09",
  sept: "09",
  october: "10",
  oct: "10",
  november: "11",
  nov: "11",
  december: "12",
  dec: "12",
};

/** Distance used to keep current Glow travel totals stable. */
const GLOW_KM: Record<string, number> = {
  f01: 4.2,
  f06: 100,
};

export function parseDollar(text: string): number | undefined {
  const match = text.replace(/,/g, "").match(/\$([0-9]+(?:\.[0-9]+)?)/);
  return match ? Number(match[1]) : undefined;
}

export function parseIsoDate(text: string | undefined): string | undefined {
  if (!text || /^on confirmation/i.test(text.trim())) return undefined;
  const iso = text.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const named = text.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (!named) return undefined;
  const month = MONTHS[named[2]!.toLowerCase()];
  if (!month) return undefined;
  return `${named[3]}-${month}-${named[1]!.padStart(2, "0")}`;
}

function covers(item: KnowledgeItem, enquiryDate: string | undefined): boolean {
  const from = parseIsoDate(item.effectiveFrom);
  const to = parseIsoDate(item.effectiveTo);
  if (from && enquiryDate && enquiryDate < from) return false;
  if (to && enquiryDate && enquiryDate >= to) return false;
  return true;
}

function byTitle(knowledge: KnowledgeItem[], title: string): KnowledgeItem[] {
  return knowledge.filter((k) => k.title === title);
}

function coveringItem(
  knowledge: KnowledgeItem[],
  title: string,
  enquiryDate: string | undefined,
): KnowledgeItem | undefined {
  const live = byTitle(knowledge, title).filter(
    (k) => k.state === "Active" || k.state === "Confirmed" || k.state === "Superseded",
  );
  const applicable = live.filter((k) => covers(k, enquiryDate));
  return applicable.find((k) => k.state === "Active" || k.state === "Confirmed") ?? applicable[0];
}

export function matchKnowledge(input: string, knowledge: KnowledgeItem[]): KnowledgeItem | undefined {
  const text = input.toLowerCase();
  const pick = (part: string) =>
    knowledge.find((k) => k.title.toLowerCase().includes(part) && k.state !== "Superseded") ??
    knowledge.find((k) => k.title.toLowerCase().includes(part));
  if (/lash/.test(text)) {
    const amount = parseDollar(input);
    const lashes = knowledge.filter((k) => k.title.toLowerCase().includes("lash"));
    if (amount != null) {
      const hit = lashes.find((k) => parseDollar(k.body) === amount);
      if (hit) return hit;
    }
    return lashes.find((k) => k.state === "Needs review") ?? lashes[0];
  }
  if (/travel/.test(text)) return pick("travel");
  if (/minimum/.test(text)) return pick("minimum");
  if (/formal|bridal|bride/.test(text)) return pick("formal");
  if (/group|party|mobile/.test(text)) return pick("group");
  if (/family/.test(text)) {
    const amount = parseDollar(input);
    const families = knowledge.filter((k) => k.title.toLowerCase().includes("family"));
    if (amount != null) {
      const hit = families.find((k) => parseDollar(k.body) === amount);
      if (hit) return hit;
    }
    return families.find((k) => k.state === "Needs review") ?? families[0];
  }
  if (/event|coverage|hour/.test(text)) return pick("event");
  if (/brand|headshot/.test(text)) return pick("brand") ?? pick("headshot");
  if (/deep/.test(text)) return pick("deep");
  if (/standard clean|standard/.test(text)) return pick("standard");
  if (/interior|bedroom|paint/.test(text)) return pick("interior");
  return knowledge.find((k) => k.section === "pricing" && k.state === "Active");
}

function namedDateIn(input: string): string | undefined {
  const match = input.match(/from\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i);
  return match?.[1];
}

export function compileBrainChange(
  business: Business,
  input: string,
  enquiries: Enquiry[],
): BrainChangePreview | null {
  const text = input.trim();
  if (!text) return null;
  const target = matchKnowledge(text, business.knowledge);
  if (!target) return null;
  const amount = parseDollar(text);
  const named = namedDateIn(text);
  const effectiveFrom = named ?? "On confirmation";
  let next = text;
  if (amount != null) {
    const title = target.title.toLowerCase();
    if (/event|hour/.test(title) || /per hour/.test(target.body)) {
      next = named
        ? `$${amount} per hour, 4-hour minimum from ${named}.`
        : `$${amount} per hour, 4-hour minimum.`;
    } else if (/family/.test(title)) {
      next = named
        ? `$${amount} for 2 hours, 30 edited images from ${named}.`
        : `$${amount} for 2 hours, 30 edited images.`;
    } else if (/brand|headshot/.test(title)) {
      next = `$${amount} half-day studio, up to 3 looks.`;
    } else if (/interior|bedroom/.test(title)) {
      next = `Standard bedroom $${amount} including prep and two coats. Living areas quoted on measure.`;
    } else if (/deep/.test(title)) {
      next = `Priced from property scope. 3 bed / 2 bath deep clean $${amount}.`;
    } else if (
      target.section === "pricing" ||
      title.includes("makeup") ||
      title.includes("lash")
    ) {
      next = named ? `$${amount} per person from ${named}.` : `$${amount} per person. Confirmed.`;
    } else if (target.title === "Travel") {
      next = target.body.replace(/\$[0-9]+(\.[0-9]+)?/, `$${amount}`);
    }
  } else if (target.title === "Mobile minimum") {
    const count = text.match(/(\d+)/)?.[1];
    next = count
      ? `Require at least ${count} makeup services for a mobile booking, unless it is a single formal and the client comes to a hosted suite.`
      : text;
  }
  const preview: BrainChangePreview = {
    id: `chg-${Date.now()}`,
    businessId: business.id,
    knowledgeId: target.id,
    input: text,
    title: target.title,
    current: target.body,
    next,
    appliesTo: target.title,
    effectiveFrom,
    section: target.section,
    class: target.class,
    highImpact: target.class === "authoritative",
    affected: [],
  };
  const nextBusiness: Business = {
    ...business,
    knowledge: knowledgeAfterPreview(business.knowledge, preview, business.id),
  };
  preview.affected = enquiries
    .filter((e) => e.businessId === business.id && e.state.lifecycle === "OPEN")
    .map((enquiry) => {
      const applied = applyBrainToEnquiry(nextBusiness, enquiry);
      const from = commercialValue(enquiry).amountLabel;
      const to = commercialValue(applied.enquiry).amountLabel;
      const jobDate = enquiry.facts.find((f) => f.field === "date")?.value;
      const appliesToJob = covers(
        {
          ...target,
          effectiveFrom,
          state: "Active",
        },
        jobDate,
      );
      if (!appliesToJob) {
        return {
          enquiryId: enquiry.id,
          customerName: enquiry.customerName,
          from,
          to: from,
          applies: false,
          note: `${enquiry.dateLabel ?? "This job"} is before ${effectiveFrom}.`,
        };
      }
      if (!applied.changed) {
        return {
          enquiryId: enquiry.id,
          customerName: enquiry.customerName,
          from,
          to: from,
          applies: true,
          note: "Open, but this rule is not used on the current quote.",
        };
      }
      return {
        enquiryId: enquiry.id,
        customerName: enquiry.customerName,
        from,
        to,
        applies: true,
      };
    });
  return preview;
}

export function knowledgeAfterPreview(
  knowledge: KnowledgeItem[],
  preview: BrainChangePreview,
  businessId: string,
): KnowledgeItem[] {
  const nextItem: KnowledgeItem = {
    id: preview.id,
    businessId,
    section: preview.section,
    title: preview.title,
    body: preview.next,
    class: preview.class,
    state: "Active",
    source: { kind: "user", label: "Told Enquiry", detail: preview.input },
    effectiveFrom: preview.effectiveFrom,
    version: "nl-v1",
  };
  return [
    nextItem,
    ...knowledge.map((item) => {
      if (item.id !== preview.knowledgeId) return item;
      if (item.state === "Superseded" || item.state === "Disabled") return item;
      return { ...item, state: "Superseded" as const, effectiveTo: preview.effectiveFrom };
    }),
  ];
}

function enquiryDate(enquiry: Enquiry): string | undefined {
  return enquiry.facts.find((f) => f.field === "date")?.value;
}

function peopleCount(enquiry: Enquiry): number {
  const raw = enquiry.facts.find((f) => f.field === "people")?.value;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function glowService(enquiry: Enquiry): "group" | "formal" | null {
  const value = enquiry.facts.find((f) => f.field === "service")?.value ?? "";
  if (value === "group-makeup" || enquiry.serviceLabel.toLowerCase().includes("group")) return "group";
  if (value === "formal-makeup" || enquiry.serviceLabel.toLowerCase().includes("formal")) return "formal";
  return null;
}

function travelCost(knowledge: KnowledgeItem[], km: number | undefined): number | undefined {
  if (km == null) return undefined;
  const rule = coveringItem(knowledge, "Travel", undefined);
  if (!rule) return undefined;
  const local = parseDollar(rule.body);
  const perKm = Number(rule.body.match(/\$([0-9]+(?:\.[0-9]+)?)\/km/)?.[1] ?? "2.2");
  if (local == null) return undefined;
  if (km <= 15) return local;
  return Math.round(local + (km - 15) * perKm);
}

function mobileMinimum(knowledge: KnowledgeItem[]): number {
  const rule = coveringItem(knowledge, "Mobile minimum", undefined);
  const n = Number(rule?.body.match(/at least\s+(\d+)/i)?.[1] ?? 3);
  return Number.isFinite(n) ? n : 3;
}

function quotedIsLocked(enquiry: Enquiry): boolean {
  if (enquiry.state.commercial === "ACCEPTED") return true;
  if (enquiry.state.commercial !== "QUOTED") return false;
  return !enquiry.decision.quotes.some((q) => q.status === "draft");
}

export function applyBrainToEnquiry(
  business: Business,
  enquiry: Enquiry,
): { enquiry: Enquiry; changed: boolean } {
  if (enquiry.businessId !== business.id) return { enquiry, changed: false };
  if (enquiry.state.lifecycle !== "OPEN") return { enquiry, changed: false };
  if (quotedIsLocked(enquiry)) return { enquiry, changed: false };
  if (business.id === "northlight") return applyNorthlight(business, enquiry);
  if (business.id === "harbour") return applyHarbour(business, enquiry);
  if (business.id === "ridge") return applyRidge(business, enquiry);
  if (business.id !== "glow") return { enquiry, changed: false };

  const next = structuredClone(enquiry);
  const date = enquiryDate(enquiry);
  const service = glowService(enquiry);
  const people = peopleCount(enquiry);
  const min = mobileMinimum(business.knowledge);
  const diffs: { factLabel: string; from: string; to: string }[] = [];

  if (service === "group" && people < min) {
    const pricing = next.decision.evaluators.find((e) => e.type === "pricing");
    const prevRec = next.decision.recommendation.label;
    next.state.decision = "ACTION_READY";
    next.state.commercial = "UNASSESSED";
    next.decision.evaluators = next.decision.evaluators.map((e) => {
      if (e.type === "eligibility") {
        return {
          ...e,
          status: "FAIL",
          summary: `Party of ${people} is below the mobile minimum of ${min}.`,
        };
      }
      if (e.type === "pricing") {
        return { ...e, status: "NOT_QUOTABLE", summary: "Exact quote blocked until the minimum is met or an exception is granted." };
      }
      return e;
    });
    next.decision.recommendation = {
      action: "SEND_QUALIFICATION_RESPONSE",
      label: ACTION_LABELS.SEND_QUALIFICATION_RESPONSE,
      reason: `A mobile booking needs at least ${min} people. This request is ${people}.`,
      requiredApproval: true,
      reasonCodes: ["SEND_QUALIFICATION_RESPONSE"],
      primaryEnabled: true,
    };
    next.decision.draft = {
      ...next.decision.draft,
      action: "SEND_QUALIFICATION_RESPONSE",
      body: `Hi ${enquiry.customerName.split(" ")[0]},\n\nI can come to you, but I need at least ${min} makeup services for a mobile booking. You're currently ${people}. Happy to add people, or we can look at a hosted suite for a single formal.\n\nMina\nGlow & Co`,
    };
    diffs.push({
      factLabel: "Mobile minimum",
      from: pricing ? "Met" : "Met",
      to: `${people} is below ${min}`,
    });
    diffs.push({ factLabel: "Recommendation", from: prevRec, to: next.decision.recommendation.label });
    next.decision.changeDiff = diffs;
    next.updatedAt = new Date().toISOString();
    return { enquiry: next, changed: true };
  }

  const title = service === "group" ? "Group mobile makeup" : service === "formal" ? "Formal makeup" : null;
  const priceRule = title ? coveringItem(business.knowledge, title, date) : undefined;
  const unit = priceRule ? parseDollar(priceRule.body) : undefined;
  if (unit == null || !service) return { enquiry, changed: false };

  const km = GLOW_KM[enquiry.id];
  const travel = travelCost(business.knowledge, km);
  const serviceAmount = unit * people;
  const travelAmount = travel ?? (service === "formal" && enquiry.id === "f15" ? undefined : 45);
  const total = travelAmount != null ? serviceAmount + travelAmount : undefined;
  const previous = enquiry.valueExact?.amount;
  const prevUnit = previous != null && people ? Math.round((previous - (enquiry.id === "f06" ? 232 : 45)) / people) : undefined;

  if (service === "formal" && enquiry.state.decision === "NEEDS_INFORMATION") {
    const assumedTravel = 45;
    const assumed = unit + assumedTravel;
    const draftBody = `Hi Chris,\n\nSaturday 5 September is possible. Formal makeup is ${formatAud(unit)} plus travel.\n\nWhere will you be getting ready? Once I have the suburb I can confirm travel and a start time.\n\nMina\nGlow & Co`;
    if (enquiry.decision.draft.body === draftBody && previous === assumed) {
      return { enquiry, changed: false };
    }
    next.valueExact = { amount: assumed, currency: "AUD" };
    next.decision.evaluators = next.decision.evaluators.map((e) => {
      if (e.type !== "pricing") return e;
      return {
        ...e,
        status: "EXACT",
        summary: `${formatAud(unit)} + local travel ${formatAud(assumedTravel)} = ${formatAud(assumed)}, once the suburb is known as local.`,
        total: { amount: assumed, currency: "AUD" },
        assumptions: ["Assumes address is within 15 km. Confirm suburb before sending as locked."],
      };
    });
    next.decision.draft = { ...next.decision.draft, body: draftBody };
    next.decision.explanation = `Formal makeup is now ${formatAud(unit)}. Travel stays unconfirmed until the suburb is known.`;
    next.decision.changeDiff = [
      { factLabel: "Formal makeup", from: prevUnit != null ? formatAud(prevUnit) : "$165", to: formatAud(unit) },
    ];
    next.updatedAt = new Date().toISOString();
    return { enquiry: next, changed: next.decision.changeDiff[0]!.from !== next.decision.changeDiff[0]!.to };
  }

  if (total == null) return { enquiry, changed: false };
  if (previous === total) return { enquiry, changed: false };

  const deposit = defaultHold(total)?.amount;
  const firstName = enquiry.customerName.split(" ")[0] ?? enquiry.customerName;
  next.valueExact = { amount: total, currency: "AUD" };
  next.state.commercial = "QUOTABLE";
  next.decision.evaluators = next.decision.evaluators.map((e) => {
    if (e.type !== "pricing") return e;
    const lineItems = [
      {
        id: "svc",
        label: `${title} × ${people}`,
        amount: serviceAmount,
        quantity: people,
        unit: "person",
        ruleId: priceRule?.id,
      },
      ...(travelAmount != null
        ? [
            {
              id: "tr",
              label: enquiry.id === "f06" ? "Travel to Toowoomba" : "Travel within 15 km",
              amount: travelAmount,
              ruleId: "glow-travel",
            },
          ]
        : []),
    ];
    return {
      ...e,
      status: "EXACT" as const,
      summary: `${formatAud(total)} including travel`,
      total: { amount: total, currency: "AUD" },
      lineItems,
      ruleIds: [priceRule?.id ?? "", "glow-travel"],
    };
  });

  if (enquiry.id === "f01") {
    next.decision.recommendation = {
      ...next.decision.recommendation,
      action: "SEND_QUOTE",
      label: ACTION_LABELS.SEND_QUOTE,
      reason: `Exact price and capacity are confirmed. Send the ${formatAud(total)} quote.`,
      primaryEnabled: true,
    };
    next.decision.draft = {
      ...next.decision.draft,
      action: "SEND_QUOTE",
      body: `Hi ${firstName},\n\nI can come to 12 Merthyr Rd on Saturday 19 September.\n\nMakeup for four of you is ${formatAud(total)} including travel. I'll plan to start around 10:45am so everyone is ready by 2pm.\n\n${deposit ? `If you'd like to hold the date, a ${formatAud(deposit)} booking fee does that and the balance is on the day.\n\n` : ""}Mina\nGlow & Co`,
    };
    next.decision.explanation = `Four group mobile makeups at ${formatAud(unit)} and local travel at ${formatAud(travelAmount ?? 45)} is ${formatAud(total)}. Calendar is clear and the 2pm ready-by time is feasible with a 10:45am start.`;
    next.decision.why = next.decision.why.map((w) =>
      w.id === "w1"
        ? {
            ...w,
            claim: `Why ${formatAud(total)}?`,
            evidence: `Group mobile makeup ${formatAud(unit)} × 4 = ${formatAud(serviceAmount)}. Travel within 15 km = ${formatAud(travelAmount ?? 45)}.`,
          }
        : w,
    );
    next.decision.quotes = [
      {
        id: "f01-q1",
        version: (enquiry.decision.quotes[0]?.version ?? 0) + 1,
        status: "draft",
        total: { amount: total, currency: "AUD" },
        lineItems: [
          { id: "p1", label: `Group mobile makeup × 4`, amount: serviceAmount },
          { id: "p2", label: "Travel within 15 km", amount: travelAmount ?? 45 },
        ],
        assumptions: ["Natural dressed-up makeup", "Ready by 2:00pm at New Farm"],
        ruleSetVersion: priceRule?.version ?? "nl-v1",
      },
    ];
  }

  if (enquiry.id === "f06") {
    next.decision.draft = {
      ...next.decision.draft,
      body: `Hi ${firstName},\n\nI can do four makeups in Toowoomba on 12 September. That's ${formatAud(serviceAmount)} plus ${formatAud(travelAmount ?? 232)} travel, ${formatAud(total)} in total.\n\nI can't be ready for an 8am start if I drive up that morning — it's a two-hour trip and I don't leave home before 6am. Two options: I come up on the Friday and stay overnight, or we aim to be ready by 9:30am.\n\nMina\nGlow & Co`,
    };
    next.decision.explanation = `Travel is ${formatAud(travelAmount ?? 232)} and almost two hours. Price is exact. Capacity fails the 8am ready-by unless Mina travels the day before or the ready-by moves.`;
  }

  diffs.push({
    factLabel: title ?? "Price",
    from: prevUnit != null ? `${formatAud(prevUnit)} per person` : enquiry.decision.quotes[0] ? formatAud(previous ?? 0) : "Previous rule",
    to: `${formatAud(unit)} per person`,
  });
  diffs.push({
    factLabel: "Quote",
    from: formatAud(previous ?? 0),
    to: formatAud(total),
  });
  next.decision.changeDiff = diffs;
  next.updatedAt = new Date().toISOString();
  return { enquiry: next, changed: true };
}

function rewriteDraftMoney(body: string, pairs: [string, string][]): string {
  let next = body;
  for (const [from, to] of pairs) {
    if (!from || from === to) continue;
    next = next.split(from).join(to);
  }
  return next;
}

function hoursSpec(enquiry: Enquiry): { kind: "range"; min: number; max: number } | { kind: "exact"; n: number } | null {
  const fact = enquiry.facts.find((f) => f.field === "hours" && !f.superseded);
  if (!fact?.value) return null;
  const range = fact.value.match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (range) return { kind: "range", min: Number(range[1]), max: Number(range[2]) };
  const n = Number(fact.value);
  return Number.isFinite(n) && n > 0 ? { kind: "exact", n } : null;
}

function applyNorthlight(
  business: Business,
  enquiry: Enquiry,
): { enquiry: Enquiry; changed: boolean } {
  const date = enquiryDate(enquiry);
  const label = enquiry.serviceLabel.toLowerCase();
  const firstName = enquiry.customerName.split(" ")[0] ?? enquiry.customerName;

  if (label.includes("event") || enquiry.facts.find((f) => f.value === "event")) {
    const rule = coveringItem(business.knowledge, "Event coverage", date);
    const rate = rule ? parseDollar(rule.body) : undefined;
    if (rate == null) return { enquiry, changed: false };
    const hours = hoursSpec(enquiry);
    if (!hours) return { enquiry, changed: false };
    const next = structuredClone(enquiry);

    if (hours.kind === "range") {
      const minH = Math.max(hours.min, 4);
      const range = { min: rate * minH, max: rate * hours.max, currency: "AUD" as const };
      if (enquiry.valueRange?.min === range.min && enquiry.valueRange?.max === range.max) {
        return { enquiry, changed: false };
      }
      const from = enquiry.valueRange
        ? `${formatAud(enquiry.valueRange.min)}–${formatAud(enquiry.valueRange.max)}`
        : "Previous estimate";
      next.valueRange = range;
      next.valueExact = undefined;
      next.decision.evaluators = next.decision.evaluators.map((e) =>
        e.type === "pricing"
          ? {
              ...e,
              status: "RANGE" as const,
              summary: `Estimated ${formatAud(range.min)}–${formatAud(range.max)}`,
              range,
              assumptions: [`${formatAud(rate)}/hr`, "4-hour minimum", "Range preserved — not coerced"],
            }
          : e,
      );
      next.decision.draft = {
        ...next.decision.draft,
        body: rewriteDraftMoney(enquiry.decision.draft.body, [
          [enquiry.valueRange ? `${formatAud(enquiry.valueRange.min)}–${formatAud(enquiry.valueRange.max)}` : "", `${formatAud(range.min)}–${formatAud(range.max)}`],
          ["$180", formatAud(rate)],
        ]),
      };
      next.decision.explanation = `Event coverage is ${formatAud(rate)}/hour with a 4-hour minimum, so ${hours.min}–${hours.max} hours is ${formatAud(range.min)}–${formatAud(range.max)}.`;
      next.decision.changeDiff = [
        { factLabel: "Event coverage", from: from, to: `${formatAud(range.min)}–${formatAud(range.max)}` },
      ];
      next.updatedAt = new Date().toISOString();
      return { enquiry: next, changed: true };
    }

    const billed = Math.max(hours.n, 4);
    const total = rate * billed;
    const previous = enquiry.valueExact?.amount;
    if (previous === total) return { enquiry, changed: false };
    next.valueExact = { amount: total, currency: "AUD" };
    next.decision.evaluators = next.decision.evaluators.map((e) =>
      e.type === "pricing"
        ? {
            ...e,
            status: "EXACT" as const,
            summary: `${formatAud(total)} for ${billed} hours`,
            total: { amount: total, currency: "AUD" },
            lineItems: [{ id: "h", label: `Event coverage × ${billed} hours`, amount: total, ruleId: rule?.id }],
          }
        : e,
    );
    const sent = enquiry.decision.quotes.find((q) => q.status === "sent");
    next.decision.quotes = [
      ...(sent ? [sent] : []),
      {
        id: `${enquiry.id}-q-draft`,
        version: (sent?.version ?? 0) + 1,
        status: "draft",
        total: { amount: total, currency: "AUD" },
        lineItems: [{ id: "h", label: `Event coverage × ${billed} hours`, amount: total }],
        assumptions: enquiry.decision.quotes.find((q) => q.status === "draft")?.assumptions ?? [],
        ruleSetVersion: rule?.version ?? "nl-v1",
      },
    ];
    const sentBit = sent?.total
      ? null
      : `Coverage of ${billed} hours is ${formatAud(total)}.`;
    next.decision.draft = {
      ...next.decision.draft,
      body: sent
        ? rewriteDraftMoney(enquiry.decision.draft.body, [
            [previous != null ? formatAud(previous) : "", formatAud(total)],
          ])
        : `Hi ${firstName},\n\n${sentBit}\n\nAlex\nNorthlight`,
    };
    next.decision.changeDiff = [
      { factLabel: "Event coverage", from: previous != null ? formatAud(previous) : "Previous rule", to: formatAud(total) },
    ];
    next.updatedAt = new Date().toISOString();
    return { enquiry: next, changed: true };
  }

  if (label.includes("family")) {
    const rule =
      coveringItem(business.knowledge, "Family session — 2026 list", date) ??
      coveringItem(business.knowledge, "Family session — website", date);
    if (!rule || rule.state === "Needs review") return { enquiry, changed: false };
    const amount = parseDollar(rule.body);
    if (amount == null) return { enquiry, changed: false };
    if (enquiry.valueExact?.amount === amount && enquiry.decision.evaluators.find((e) => e.type === "pricing")?.status === "EXACT") {
      return { enquiry, changed: false };
    }
    const next = structuredClone(enquiry);
    next.valueExact = { amount, currency: "AUD" };
    next.state.decision = "ACTION_READY";
    next.state.commercial = "QUOTABLE";
    next.decision.conflicts = [];
    next.decision.evaluators = next.decision.evaluators.map((e) =>
      e.type === "pricing"
        ? {
            ...e,
            status: "EXACT" as const,
            summary: `${formatAud(amount)} family session`,
            total: { amount, currency: "AUD" },
          }
        : e,
    );
    next.decision.recommendation = {
      action: "SEND_QUOTE",
      label: ACTION_LABELS.SEND_QUOTE,
      reason: "Price conflict resolved. Exact quote is now allowed.",
      requiredApproval: true,
      reasonCodes: ["SEND_QUOTE"],
      primaryEnabled: true,
    };
    next.decision.draft = {
      ...next.decision.draft,
      action: "SEND_QUOTE",
      body: `Hi ${firstName},\n\nA family session is ${formatAud(amount)} for two hours and 30 edited images.\n\nAlex\nNorthlight`,
    };
    next.decision.changeDiff = [{ factLabel: "Family session", from: "Conflict", to: formatAud(amount) }];
    next.updatedAt = new Date().toISOString();
    return { enquiry: next, changed: true };
  }

  if (label.includes("brand") || label.includes("headshot")) {
    const rule = coveringItem(business.knowledge, "Brand / headshot half-day", date);
    const amount = rule ? parseDollar(rule.body) : undefined;
    if (amount == null || enquiry.valueExact?.amount === amount) return { enquiry, changed: false };
    const next = structuredClone(enquiry);
    next.valueExact = { amount, currency: "AUD" };
    next.decision.evaluators = next.decision.evaluators.map((e) =>
      e.type === "pricing"
        ? { ...e, status: "EXACT" as const, summary: `${formatAud(amount)} half-day brand / headshot`, total: { amount, currency: "AUD" } }
        : e,
    );
    next.decision.changeDiff = [
      { factLabel: "Brand / headshot", from: enquiry.valueExact ? formatAud(enquiry.valueExact.amount) : "Previous", to: formatAud(amount) },
    ];
    next.updatedAt = new Date().toISOString();
    return { enquiry: next, changed: true };
  }

  return { enquiry, changed: false };
}

function applyHarbour(
  business: Business,
  enquiry: Enquiry,
): { enquiry: Enquiry; changed: boolean } {
  const type = enquiry.facts.find((f) => f.field === "clean_type")?.value;
  const title = type === "deep" ? "Deep clean" : type === "standard" ? "Standard clean" : null;
  if (!title) return { enquiry, changed: false };
  const rule = coveringItem(business.knowledge, title, enquiryDate(enquiry));
  const amount = rule ? parseDollar(rule.body) : undefined;
  if (amount == null) return { enquiry, changed: false };
  if (enquiry.valueExact?.amount === amount) return { enquiry, changed: false };
  if (!enquiry.valueExact && enquiry.state.commercial === "UNASSESSED") return { enquiry, changed: false };
  const next = structuredClone(enquiry);
  const previous = enquiry.valueExact?.amount;
  next.valueExact = { amount, currency: "AUD" };
  next.decision.evaluators = next.decision.evaluators.map((e) =>
    e.type === "pricing"
      ? { ...e, status: "EXACT" as const, summary: `${formatAud(amount)} ${title.toLowerCase()}`, total: { amount, currency: "AUD" } }
      : e,
  );
  next.decision.changeDiff = [
    { factLabel: title, from: previous != null ? formatAud(previous) : "Previous rule", to: formatAud(amount) },
  ];
  next.updatedAt = new Date().toISOString();
  return { enquiry: next, changed: true };
}

function applyRidge(
  business: Business,
  enquiry: Enquiry,
): { enquiry: Enquiry; changed: boolean } {
  if (!enquiry.serviceLabel.toLowerCase().includes("interior")) return { enquiry, changed: false };
  const rule = coveringItem(business.knowledge, "Interior room rate", enquiryDate(enquiry));
  const unit = rule ? parseDollar(rule.body) : undefined;
  if (unit == null) return { enquiry, changed: false };
  const roomsRaw = enquiry.facts.find((f) => f.field === "rooms")?.value ?? "";
  const rooms = parseInt(roomsRaw, 10);
  const superseded = business.knowledge.find(
    (k) => k.title === "Interior room rate" && k.state === "Superseded",
  );
  const oldUnit = superseded ? parseDollar(superseded.body) : 420;
  const qty = Number.isFinite(rooms) && rooms > 0 ? rooms : enquiry.valueExact && oldUnit ? enquiry.valueExact.amount / oldUnit : 0;
  if (!qty) return { enquiry, changed: false };
  const total = Math.round(qty * unit);
  if (enquiry.valueExact?.amount === total) return { enquiry, changed: false };
  const next = structuredClone(enquiry);
  const previous = enquiry.valueExact?.amount;
  next.valueExact = { amount: total, currency: "AUD" };
  next.decision.evaluators = next.decision.evaluators.map((e) =>
    e.type === "pricing"
      ? { ...e, status: "EXACT" as const, summary: `${formatAud(total)} interior`, total: { amount: total, currency: "AUD" } }
      : e,
  );
  next.decision.changeDiff = [
    { factLabel: "Interior room rate", from: previous != null ? formatAud(previous) : "Previous", to: formatAud(total) },
  ];
  next.updatedAt = new Date().toISOString();
  return { enquiry: next, changed: true };
}

export function applyBrainToOpenEnquiries(
  business: Business,
  enquiries: Enquiry[],
): { enquiries: Enquiry[]; affectedIds: string[] } {
  const affectedIds: string[] = [];
  const next = enquiries.map((enquiry) => {
    if (enquiry.businessId !== business.id) return enquiry;
    if (enquiry.state.lifecycle !== "OPEN") return enquiry;
    const result = applyBrainToEnquiry(business, enquiry);
    if (result.changed) affectedIds.push(enquiry.id);
    return result.enquiry;
  });
  return { enquiries: next, affectedIds };
}
