import { createHash } from "node:crypto";
import type { Sql } from "../db.ts";
import type { Channel, DecisionPrice, EvaluatorResult } from "../../domain/types.ts";
import {
  INSURANCE_WORDS,
  dollarMatches,
  sentenceAt,
  unreadableMoney,
  type DollarMatch,
} from "../../domain/voice-detect.ts";
import { standsAsQuoted, type QuoteLineAmount } from "../../domain/money-labels.ts";
import { formatMinorAud } from "../../domain/money-format.ts";
import { COVERAGE_FIELD } from "../../domain/coverage.ts";
import { isClosed, lockEnquiry } from "./decision-apply.ts";
import { ownerEditWarnings, sentencesOf } from "../../domain/edit-warnings.ts";
import { activeDetails, closedTimesOf } from "../../domain/business-detail.ts";
import type { ClosedTimes } from "../../domain/compose-reply.ts";
import { keepsScope, type CoverageFold } from "../../domain/coverage-fold.ts";

/**
 * Preparing a send for review, as pure SQL logic.
 *
 * A reviewed send is the artefact the whole commercial-correctness slice rests
 * on. It freezes, server-side, exactly what the owner had in front of them: the
 * text, the structured amount, the service, the channel, the recipient and the
 * decision revision. Confirming a send then records THAT, rather than
 * re-reading a snapshot which may have moved, or trusting an amount the client
 * sent.
 *
 * Three defects it closes:
 *
 *  - the recorded message could say AUD 500 while the recorded quote said
 *    AUD 580, because the body came from the client and the amount from the
 *    current snapshot (review P1-05);
 *  - an approval prepared against one decision could be acted on after the
 *    facts changed, pairing old text with a new amount;
 *  - a retry, a refresh or a lost response created a second send, because the
 *    idempotency key was a fresh uuid generated on every dialog open (P1-04).
 *
 * The last one is why identity is content-derived: one row per (enquiry, exact
 * text). The decision revision is deliberately NOT part of that key - recording
 * a send bumps it, so including it would let a refresh-and-retry create a second
 * artefact and record the same message twice. See migrations/0007 for the full
 * reasoning. Preparing the same review twice returns the same row, so every one
 * of those recoveries confirms the SAME send, while two genuinely different
 * follow-ups differ in their text and get their own rows.
 */

export type PrepareReviewInput = {
  enquiryId: string;
  businessId: string;
  userId: string;
  /** The text on screen, which the owner may have edited. */
  body: string;
  channel: Channel;
  /** The clock the owner's days are read against; injected in tests. */
  now?: Date;
};

export type PrepareReviewResult =
  | {
      ok: true;
      reviewedSendId: string;
      decisionRevision: number;
      recipient: string;
      channel: Channel;
      action: string;
      body: string;
      amountMinor: number | null;
      currency: string | null;
      alreadyConfirmed: boolean;
      /**
       * "Check this before you send": promises and claims the owner wrote
       * that the app cannot vouch for. Sending anyway is one tap, recorded.
       */
      warnings: string[];
      /**
       * Whether the text itself names the decision's amount (both ends of a
       * range). The send line shows the amount only when it does, and says
       * "No price in this reply" otherwise (doc 50 S2).
       */
      namesAmount: boolean;
      /** The range the artefact was frozen with, for an estimate. */
      rangeMinor: { min: number; max: number } | null;
      /** Recording this reply also confirms what the price covers (doc 51 decision 1). */
      confirmsCoverage: boolean;
    }
  | {
      ok: false;
      /**
       * `closed` - the enquiry is no longer open.
       * `not_sendable` - the decision does not authorise a customer-facing send.
       * `service_unconfirmed` - a quote whose service premise nobody confirmed.
       * `amount_mismatch` - the text names money the structured decision does not.
       * `practice` - a practice enquiry, which nothing is ever sent from.
       * `unconfirmed_reading` - the decision rests on a count read from the
       *   customer's message that the owner has not confirmed.
       */
      reason:
        | "closed"
        | "not_sendable"
        | "service_unconfirmed"
        | "amount_mismatch"
        | "practice"
        | "unconfirmed_reading"
        | "coverage_unconfirmed"
        | "scope_removed"
        | "amount_unreadable";
      message: string;
      /**
       * For `amount_mismatch`: which figures in the text the decision does not
       * imply, and the total it does - so the owner is told exactly which
       * amount differs and can put the total back or add the missing line.
       */
      amounts?: { named: number[]; expectedMinor: number | null };
    };

/**
 * The money a reply names, less the figures inside a sentence that is the
 * owner's own answer, inserted verbatim ("We have $20m public liability.").
 * Only that sentence's own figures are trusted, and only where the sentence
 * stands exactly as the owner wrote it: the same number anywhere else, or in a
 * sentence they edited, is money like any other.
 */
export function moneyOutsideAnswers(
  body: string,
  ownerTexts: readonly string[] = [],
): DollarMatch[] {
  const spans: { from: number; to: number; own: Set<number> }[] = [];
  for (const raw of ownerTexts) {
    const text = raw.trim();
    if (!text) continue;
    const own = new Set(dollarMatches(text).map((m) => Math.round(m.amount * 100)));
    for (let at = body.indexOf(text); at !== -1; at = body.indexOf(text, at + 1)) {
      spans.push({ from: at, to: at + text.length, own });
    }
  }
  return dollarMatches(body).filter(
    (m) =>
      !spans.some(
        (s) =>
          m.index >= s.from &&
          m.index + m.raw.length <= s.to &&
          s.own.has(Math.round(m.amount * 100)),
      ),
  );
}

/** Every figure a reply names outside the owner's own answer sentences. */
export function moneyFigures(body: string, ownerTexts: readonly string[] = []): number[] {
  return moneyOutsideAnswers(body, ownerTexts).map((m) => m.amount);
}

type MoneyCheck = {
  ok: boolean;
  /** Figures the decision does not allow, in minor units. */
  named: number[];
  expectedMinor: number | null;
  /** A refused figure sits in a sentence about insurance. */
  insurance: boolean;
  /** A figure is in another currency. */
  foreign: boolean;
  /** Each refused figure where it stands. */
  refused: { index: number; raw: string; minor: number }[];
};

/**
 * The one rule for money in a reply. A figure is allowed only when it is an
 * amount of the quote (its total, its lines, the owner's rule amounts it
 * implies) or it sits inside the owner's own answer sentence, as written. No
 * word beside a figure ("insurance", "cover", "excess") makes it anything but
 * money: a cover figure goes in a saved answer, where it is the owner's.
 */
/**
 * What the reply is checked against beyond the amounts: the app's own prepared
 * reply and the quote's lines, so a line's amount is allowed only where it is
 * said as that line (see `money-labels.ts`).
 */
export type QuoteContext = { draft: string; lines: readonly QuoteLineAmount[] };

function checkMoney(
  body: string,
  price: DecisionPrice | null,
  impliedMinor: readonly number[] = [],
  ownerTexts: readonly string[] = [],
  quote?: QuoteContext,
): MoneyCheck {
  const expectedMinor = price?.kind === "EXACT" ? price.amountMinor : null;
  const free = moneyOutsideAnswers(body, ownerTexts);
  const none = {
    ok: true,
    named: [],
    expectedMinor,
    insurance: false,
    foreign: false,
    refused: [],
  };
  // A message that names no money of its own is left alone: the structured
  // quote carries the figure, and an owner may write a covering note.
  if (free.length === 0) return none;
  const required = !price
    ? []
    : price.kind === "EXACT"
      ? [price.amountMinor]
      : [price.minMinor, price.maxMinor];
  const allowed = new Set<number>([...required, ...impliedMinor]);
  const minor = (m: DollarMatch) => Math.round(m.amount * 100);
  // No quote: any money at all is refused. A foreign amount never matches.
  const refused = free.filter(
    (m) =>
      !price ||
      m.foreign ||
      !allowed.has(minor(m)) ||
      (quote !== undefined && !standsAsQuoted(body, m, minor(m), { totals: required, ...quote })),
  );
  const stated = new Set(free.filter((m) => !m.foreign).map(minor));
  const missingTotal = Boolean(price) && !required.every((r) => stated.has(r));
  const insurance = refused.some((m) =>
    INSURANCE_WORDS.test(sentenceAt(body, m.index, m.index + m.raw.length)),
  );
  return {
    ok: refused.length === 0 && !missingTotal,
    named: [...new Set(refused.map(minor))],
    expectedMinor,
    insurance,
    foreign: refused.some((m) => m.foreign),
    refused: refused.map((m) => ({ index: m.index, raw: m.raw, minor: minor(m) })),
  };
}

/** The clause around a figure: "the total is $20m" in "We're insured for $20m, and the total is $20m." */
function clauseAt(body: string, index: number, length: number): string {
  const sentence = sentenceAt(body, index, index + length);
  const at = body.lastIndexOf(sentence, index);
  const from = at === -1 ? 0 : index - at;
  const head = sentence.slice(0, from);
  const last = [...head.matchAll(/[,;]|\b(?:and|but)\b/gi)].at(-1);
  const start = last ? last.index + last[0].length : 0;
  const tail = sentence.slice(from + length);
  const stop = tail.search(/[,;]|\b(?:and|but)\b/i);
  return sentence.slice(start, stop === -1 ? sentence.length : from + length + stop).trim();
}

export function mismatchAmounts(
  body: string,
  price: DecisionPrice | null,
  impliedMinor: number[] = [],
  ownerTexts: readonly string[] = [],
  quote?: QuoteContext,
): { named: number[]; expectedMinor: number | null } {
  const { named, expectedMinor } = checkMoney(body, price, impliedMinor, ownerTexts, quote);
  return { named, expectedMinor };
}

/** The message that says a cover figure belongs in a saved answer. */
export const INSURANCE_AS_ANSWER =
  "Write insurance cover as a saved answer so Enquiry can check it.";

/** Words that make a sentence about the price, whatever else it mentions. */
const PRICE_WORDS =
  /\b(?:total|price|prices|quote|quoted|comes?\s+to|all\s+up|costs?|charge[ds]?|fees?|pay|deposit|per|each|hour|hourly|rate|discount|off)\b/i;

/** A saved answer of the owner's: "We have $10 million public liability insurance." */
export type SavedAnswer = { topic: string; text: string };

function plain(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9$.%]+/g, " ")
    .replace(/\.(?!\d)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The owner's own saved answers as they appear in a reply, typed by hand or
 * inserted: a sentence that reads the same as a saved answer (case, spacing
 * and full stops aside) is that answer. So is a sentence about insurance
 * whose every figure is the saved insurance answer's own figure ("We carry
 * $10m cover" beside "$10 million public liability") - never a different one.
 */
export function savedAnswerSentences(body: string, saved: readonly SavedAnswer[]): string[] {
  if (saved.length === 0) return [];
  const texts = new Set(saved.map((a) => plain(a.text)));
  const cover = new Set(
    saved
      .filter((a) => a.topic === "insurance")
      .flatMap((a) => dollarMatches(a.text).map((m) => Math.round(m.amount * 100))),
  );
  return sentencesOf(body).filter((s) => {
    if (texts.has(plain(s))) return true;
    const figures = dollarMatches(s);
    // Only a sentence about the cover alone: "insured for $20m, and the total
    // is $20m" states a price too, and that figure is money like any other.
    return (
      cover.size > 0 &&
      figures.length > 0 &&
      INSURANCE_WORDS.test(s) &&
      !PRICE_WORDS.test(s) &&
      figures.every((m) => !m.foreign && cover.has(Math.round(m.amount * 100)))
    );
  });
}

/** "Your saved insurance answer says $10,000,000." when a cover figure differs from it. */
function insuranceMessage(saved: readonly SavedAnswer[]): string {
  const figure = saved
    .filter((a) => a.topic === "insurance")
    .flatMap((a) => dollarMatches(a.text))
    .find((m) => !m.foreign);
  return figure
    ? `Your saved insurance answer says ${formatMinorAud(Math.round(figure.amount * 100))}. Use that figure, or change your saved answer first.`
    : INSURANCE_AS_ANSWER;
}

/** "Your reply says $880, but the quote Enquiry worked out is $760." */
export function mismatchMessage(
  body: string,
  price: DecisionPrice | null,
  impliedMinor: number[] = [],
  ownerTexts: readonly string[] = [],
  quote?: QuoteContext,
  saved: readonly SavedAnswer[] = [],
): string {
  const check = checkMoney(body, price, impliedMinor, ownerTexts, quote);
  // The saved cover figure said as a price ("the total is $20m"): the clause
  // that prices it is the problem, never the cover figure itself.
  const cover = new Set(
    saved
      .filter((a) => a.topic === "insurance")
      .flatMap((a) => dollarMatches(a.text).map((m) => Math.round(m.amount * 100))),
  );
  const priced = check.refused
    .filter((m) => cover.has(m.minor))
    .map((m) => clauseAt(body, m.index, m.raw.length))
    .find((clause) => PRICE_WORDS.test(clause) && !INSURANCE_WORDS.test(clause));
  if (priced && check.expectedMinor !== null) {
    return `"${priced}" says your insurance figure is a price. The quote Enquiry worked out is ${formatMinorAud(check.expectedMinor)}: take that out, or use the prepared total.`;
  }
  if (check.insurance) return insuranceMessage(saved);
  if (check.foreign) return "Write amounts in Australian dollars so Enquiry can check them.";
  const total = check.expectedMinor !== null ? formatMinorAud(check.expectedMinor) : null;
  const says = check.named.map((n) => formatMinorAud(n)).join(" and ");
  if (!total) {
    return "Your reply names an amount, but Enquiry has no price on file for this enquiry yet. Take the amount out, or add the price first.";
  }
  if (says) {
    return `Your reply says ${says}, but the quote Enquiry worked out is ${total}. Use the prepared total, or add a line for what the difference is.`;
  }
  return `Your reply no longer names the quote total, ${total}. Use the prepared total, or add a line for what changed.`;
}

/** Normalised so trivial line-ending or trailing-space differences are one text. */
export function normalizeBody(body: string): string {
  return body.replace(/\r\n?/g, "\n").trim();
}

export function bodyHash(body: string): string {
  return createHash("sha256").update(normalizeBody(body), "utf8").digest("hex");
}

/**
 * Mirrors `resolveToAddr` in `sent-reply-core.ts` exactly: the recipient is
 * derived from the enquiry's own stored contact fields for the resolved
 * channel, never from anything the client sent, and "" is a genuine "no
 * recipient on file" rather than an invented address.
 */
export function resolveRecipient(
  channel: Channel,
  enquiry: {
    customer_email: string;
    customer_phone: string | null;
    customer_handle: string | null;
  },
): string {
  if (channel === "email") return enquiry.customer_email;
  if (channel === "sms") return enquiry.customer_phone ?? "";
  if (channel === "instagram" || channel === "facebook") return enquiry.customer_handle ?? "";
  return enquiry.customer_email || enquiry.customer_phone || enquiry.customer_handle || "";
}

/**
 * Actions that put a real outbound record on the enquiry when confirmed.
 * Anything else has no business creating a reviewed send.
 */
const SENDABLE = new Set([
  "ACKNOWLEDGE",
  "REQUEST_INFORMATION",
  "SEND_QUALIFICATION_RESPONSE",
  "SEND_AVAILABILITY",
  "SEND_ESTIMATE",
  "SEND_QUOTE",
  "RECOMMEND_OFFER",
  "OFFER_BOOKING",
  "HANDOFF_BOOKING",
  "FOLLOW_UP",
  "DECLINE",
]);

/**
 * Whether the reviewed text's money agrees with the structured decision.
 *
 * Deliberately a CHECK, not an extraction: prose never becomes an authoritative
 * price here. An owner is free to rewrite the tone, the greeting, the whole
 * letter - but if they change the figure, the structured amount and the text
 * would then say different things, and that is refused rather than recorded
 * with a warning attached. Repricing goes through the decision, not the
 * textarea.
 *
 * Two conditions, and both matter:
 *
 *  1. **Nothing unimplied.** Every figure named must be one the decision itself
 *     implies - the total, the unit rate, or the minimum-billed total (see
 *     `impliedAmountsMinor`). This is what lets the product send its own
 *     composed draft, "That comes to $580. 4 people at $145 each.", which the
 *     first version of this check refused on every per-unit quote because it
 *     compared each figure against the total alone.
 *  2. **The total is still stated.** If the message talks about money at all,
 *     it must still name the amount the quote will be recorded at. Without
 *     this, quietly replacing "$580" with "$145" would pass condition 1 - every
 *     remaining figure is implied - while the message told the customer one
 *     number and the quote recorded another.
 *
 * A message that names no money is left alone: the structured quote carries the
 * figure, and an owner is allowed to write a covering note.
 */
export function amountAgrees(
  body: string,
  price: DecisionPrice | null,
  impliedMinor: number[] = [],
  ownerTexts: readonly string[] = [],
  quote?: QuoteContext,
): boolean {
  return checkMoney(body, price, impliedMinor, ownerTexts, quote).ok;
}

/**
 * Whether the price the current decision shows has been confirmed by the
 * owner: the snapshot says so AND a live, owner-asserted coverage fact holds
 * the same key. A decision with a price but no coverage at all (made before
 * this existed) counts as unconfirmed; one with no price at all is "none".
 */
async function coverageNow(
  sql: Sql,
  enquiryId: string,
): Promise<"none" | "unconfirmed" | "confirmed"> {
  const [snap] = await sql<{ key: string | null; confirmed: string | null; priced: boolean }>`
    select decision_snapshot -> 'coverage' ->> 'key' as key,
      decision_snapshot -> 'coverage' ->> 'confirmed' as confirmed,
      (decision_snapshot -> 'price') is not null as priced
    from enquiry where id = ${enquiryId}
  `;
  if (!snap?.key) return snap?.priced ? "unconfirmed" : "none";
  if (snap.confirmed !== "true") return "unconfirmed";
  const [fact] = await sql<{ id: string }>`
    select id from enquiry_fact
    where enquiry_id = ${enquiryId} and lower(field) = ${COVERAGE_FIELD} and superseded = false
      and status = ${"confirmed"} and asserted_by = ${"user"} and value = ${snap.key}
    limit 1
  `;
  return fact ? "confirmed" : "unconfirmed";
}

type SnapshotRow = {
  customer_email: string;
  customer_phone: string | null;
  customer_handle: string | null;
  service_label: string | null;
  action: string | null;
  reason: string | null;
  price: DecisionPrice | null;
  implied_amounts: number[] | null;
  owner_texts: string[] | null;
  draft_body: string | null;
  evaluators: EvaluatorResult[] | null;
  missing: { factField?: string; inferred?: unknown }[] | null;
  fold: CoverageFold | null;
  coverage_key: string | null;
  engine_version: string;
};

/** The message for a folded reply that no longer says what the price covers. */
export const SCOPE_REMOVED =
  "Keep the lines that say what the price covers and what it leaves out. The customer reads those, so a reply without them can't be copied.";

/**
 * Whether a text names the decision's own amount: the total, or both ends of a
 * range, outside the owner's own answer sentences.
 */
export function namesAmount(
  body: string,
  price: DecisionPrice | null,
  ownerTexts: readonly string[] = [],
): boolean {
  if (!price) return false;
  const stated = new Set(
    moneyOutsideAnswers(body, ownerTexts)
      .filter((m) => !m.foreign)
      .map((m) => Math.round(m.amount * 100)),
  );
  const required = price.kind === "EXACT" ? [price.amountMinor] : [price.minMinor, price.maxMinor];
  return required.every((r) => stated.has(r));
}

/**
 * Freeze what the owner is about to review. Assumes it is ALREADY inside a
 * transaction: the lock, the validation and the insert have to be atomic, or a
 * concurrent fact change can move the decision between the check and the row.
 */
export async function prepareReviewedSendInTransaction(
  sql: Sql,
  input: PrepareReviewInput,
): Promise<PrepareReviewResult> {
  const locked = await lockEnquiry(sql, input.enquiryId);
  if (!locked) {
    return { ok: false, reason: "closed", message: "That enquiry no longer exists." };
  }
  if (isClosed(locked.lifecycle)) {
    return {
      ok: false,
      reason: "closed",
      message: "That enquiry is closed, so there is nothing to send.",
    };
  }
  // No preview, no artefact, so no path to a recorded send exists for it.
  const [practice] = await sql<{ practice: boolean }>`
    select practice from enquiry where id = ${input.enquiryId}
  `;
  if (practice?.practice) {
    return {
      ok: false,
      reason: "practice",
      message:
        "This is a practice enquiry, so nothing is sent or recorded from it. With a real enquiry, this is where you check the reply before you send it yourself.",
    };
  }

  const [enq] = await sql<SnapshotRow>`
    select customer_email, customer_phone, customer_handle, service_label,
      decision_snapshot -> 'recommendation' ->> 'action' as action,
      decision_snapshot -> 'recommendation' ->> 'reason' as reason,
      decision_snapshot -> 'price' as price,
      decision_snapshot -> 'impliedAmountsMinor' as implied_amounts,
      decision_snapshot -> 'ownerAnswerTexts' as owner_texts,
      decision_snapshot -> 'draft' ->> 'body' as draft_body,
      decision_snapshot -> 'evaluators' as evaluators,
      decision_snapshot -> 'missing' as missing,
      decision_snapshot -> 'fold' as fold,
      decision_snapshot -> 'coverage' ->> 'key' as coverage_key,
      engine_version
    from enquiry where id = ${input.enquiryId}
  `;
  if (!enq) {
    return { ok: false, reason: "closed", message: "That enquiry no longer exists." };
  }

  // Money Enquiry cannot read ("nine-ish hundred dollars") cannot be checked
  // against the quote, so it is never recorded.
  if (unreadableMoney(input.body)) {
    return {
      ok: false,
      reason: "amount_unreadable",
      message: "Write the amount in numbers so Enquiry can check it.",
    };
  }

  // A reply may state a price only once the owner has confirmed what it
  // covers, for this revision. Checked against the stored confirmation itself,
  // not only the snapshot, so a crafted body cannot name a total early.
  // Only the owner's own answer sentences, as written, carry figures of their
  // own; a snapshot from before these were recorded trusts none. The owner's
  // saved answers count too, typed by hand or inserted.
  const business = await businessFacts(sql, input.businessId);
  const ownerTexts = [
    ...(Array.isArray(enq.owner_texts) ? enq.owner_texts : []),
    ...savedAnswerSentences(input.body, business.saved),
  ];
  // The coverage tap folded into Copy: only while this exact coverage is still
  // unconfirmed, and only for a reply that still says everything the scope
  // lines say. Recording it is what confirms the coverage (sent-reply-core).
  const folding =
    enq.fold && enq.fold.key === enq.coverage_key
      ? (await coverageNow(sql, input.enquiryId)) === "unconfirmed"
        ? enq.fold
        : null
      : null;
  if (!folding && moneyFigures(input.body, ownerTexts).length > 0) {
    const coverage = await coverageNow(sql, input.enquiryId);
    if (coverage === "unconfirmed") {
      return {
        ok: false,
        reason: "coverage_unconfirmed",
        message:
          "Check what this price covers first. A reply can only name the total once you have confirmed it covers everything they asked for.",
      };
    }
  }

  const action = folding ? "SEND_QUOTE" : (enq.action ?? "");
  if (!SENDABLE.has(action)) {
    return {
      ok: false,
      reason: "not_sendable",
      message: "Enquiry has not prepared anything to send for this one.",
    };
  }

  // A reading of the customer's own words ("roughly 120 square metres") is
  // something the owner checks with one tap, not something a reply may rest
  // on. Until it is confirmed there is nothing to record as sent.
  if ((enq.missing ?? []).some((m) => m && m.inferred)) {
    return {
      ok: false,
      reason: "unconfirmed_reading",
      message:
        "Enquiry read a detail from their message that you have not confirmed yet. Check it first, then the reply is ready.",
    };
  }

  // A quote is the point at which a service becomes a commercial commitment, so
  // this is where the owner's confirmation of it is actually required - not
  // merely displayed. A model-proposed service never reaches here (the decision
  // is ESCALATE_HUMAN, filtered above), but an enquiry created before that rule
  // existed can carry a nonblank service_label with no authority behind it at
  // all, and a bare label is not evidence that a human agreed with it.
  if (action === "SEND_QUOTE" || action === "SEND_ESTIMATE") {
    const [confirmedService] = await sql<{ id: string }>`
      select id from enquiry_fact
      where enquiry_id = ${input.enquiryId} and lower(field) = ${"service"}
        and superseded = false and status = ${"confirmed"}
      limit 1
    `;
    if (!confirmedService) {
      return {
        ok: false,
        reason: "service_unconfirmed",
        message: `Confirm the service for this enquiry before quoting it${
          enq.service_label ? ` - Enquiry has it as "${enq.service_label}"` : ""
        }.`,
      };
    }
  }

  const price = folding ? folding.price : (enq.price ?? null);
  // What the owner was shown as the prepared reply: the folded one names the
  // total its confirmation will authorise.
  const prepared = folding ? folding.body : (enq.draft_body ?? "");
  // A line's amount only where it is said as that line: in the prepared
  // reply's own sentence, or beside a word of that line's own name.
  const quote: QuoteContext = {
    draft: prepared,
    lines:
      price?.kind === "EXACT" && price.lines?.length
        ? price.lines
        : price?.kind === "EXACT"
          ? [{ label: enq.service_label ?? "", amountMinor: price.amountMinor }]
          : [],
  };
  const implied = folding ? folding.impliedAmountsMinor : (enq.implied_amounts ?? []);
  if (!amountAgrees(input.body, price, implied, ownerTexts, quote)) {
    return {
      ok: false,
      reason: "amount_mismatch",
      message: mismatchMessage(input.body, price, implied, ownerTexts, quote, business.saved),
      amounts: mismatchAmounts(input.body, price, implied, ownerTexts, quote),
    };
  }
  // A changed total is said as that, with its fix; a reply that dropped what
  // the price covers is refused as that.
  if (folding && !keepsScope(input.body, folding.scope)) {
    return { ok: false, reason: "scope_removed", message: SCOPE_REMOVED };
  }

  const body = normalizeBody(input.body);
  const hash = bodyHash(body);
  const recipient = resolveRecipient(input.channel, enq);

  // One row per (enquiry, exact text). `on conflict` is what makes preparing
  // the same review twice - a refresh, a reopened dialog, a retry after a lost
  // response - resolve to the SAME artefact rather than a second one, and
  // `do update` rather than `do nothing` so the id comes back either way.
  //
  // A row nobody has recorded yet is bound again to the decision it was just
  // checked against: every rule above ran on THIS revision, so the same text
  // is a fresh review now (an owner's kept edit after "Use this name" was
  // otherwise refused as stale forever). An artefact that is not prepared
  // again stays pinned to the revision it described, so confirming it after
  // the facts moved is still stale. A recorded row is never re-pointed.
  const [row] = await sql<{
    id: string;
    consumed_at: string | null;
    decision_revision: string | number;
    amount_minor: string | number | null;
    currency: string | null;
    range_min_minor: string | number | null;
    range_max_minor: string | number | null;
    coverage_key: string | null;
  }>`
    insert into reviewed_send
      (enquiry_id, business_id, reviewed_by, decision_revision, action, channel,
       recipient, body, body_hash, price_kind, amount_minor, range_min_minor,
       range_max_minor, currency, service_label, reason, evaluators, engine_version, draft_body,
       coverage_key)
    values (
      ${input.enquiryId}, ${input.businessId}, ${input.userId}, ${locked.decisionRevision},
      ${action}, ${input.channel}, ${recipient}, ${body}, ${hash},
      ${price?.kind ?? null},
      ${price?.kind === "EXACT" ? price.amountMinor : null},
      ${price?.kind === "RANGE" ? price.minMinor : null},
      ${price?.kind === "RANGE" ? price.maxMinor : null},
      ${price?.currency ?? null},
      ${enq.service_label ?? ""}, ${enq.reason ?? ""},
      ${enq.evaluators ? JSON.stringify(enq.evaluators) : null}::jsonb,
      ${enq.engine_version ?? "0"}, ${prepared}, ${folding?.key ?? null}
    )
    on conflict (enquiry_id, body_hash)
      do update set
        reviewed_by = excluded.reviewed_by,
        decision_revision = case when reviewed_send.consumed_at is null then excluded.decision_revision else reviewed_send.decision_revision end,
        action = case when reviewed_send.consumed_at is null then excluded.action else reviewed_send.action end,
        channel = case when reviewed_send.consumed_at is null then excluded.channel else reviewed_send.channel end,
        recipient = case when reviewed_send.consumed_at is null then excluded.recipient else reviewed_send.recipient end,
        price_kind = case when reviewed_send.consumed_at is null then excluded.price_kind else reviewed_send.price_kind end,
        amount_minor = case when reviewed_send.consumed_at is null then excluded.amount_minor else reviewed_send.amount_minor end,
        range_min_minor = case when reviewed_send.consumed_at is null then excluded.range_min_minor else reviewed_send.range_min_minor end,
        range_max_minor = case when reviewed_send.consumed_at is null then excluded.range_max_minor else reviewed_send.range_max_minor end,
        currency = case when reviewed_send.consumed_at is null then excluded.currency else reviewed_send.currency end,
        service_label = case when reviewed_send.consumed_at is null then excluded.service_label else reviewed_send.service_label end,
        reason = case when reviewed_send.consumed_at is null then excluded.reason else reviewed_send.reason end,
        evaluators = case when reviewed_send.consumed_at is null then excluded.evaluators else reviewed_send.evaluators end,
        engine_version = case when reviewed_send.consumed_at is null then excluded.engine_version else reviewed_send.engine_version end,
        draft_body = case when reviewed_send.consumed_at is null then excluded.draft_body else reviewed_send.draft_body end,
        coverage_key = case when reviewed_send.consumed_at is null then excluded.coverage_key else reviewed_send.coverage_key end
    returning id, consumed_at, decision_revision, amount_minor, currency, range_min_minor,
      range_max_minor, coverage_key
  `;
  if (!row) throw new Error("Could not prepare that send for review.");

  return {
    ok: true,
    reviewedSendId: row.id,
    // The row's own revision, not the enquiry's current one - an artefact that
    // already existed keeps the decision it was prepared against.
    decisionRevision: Number(row.decision_revision),
    recipient,
    channel: input.channel,
    action,
    body,
    // The artefact's OWN frozen figures, not the live snapshot's. An artefact
    // that already existed keeps the amount it was prepared with, so this
    // payload cannot report an old revision beside a new price.
    amountMinor: row.amount_minor === null ? null : Number(row.amount_minor),
    currency: row.currency,
    alreadyConfirmed: Boolean(row.consumed_at),
    warnings: ownerEditWarnings(body, prepared, {
      closed: business.closed,
      ...(input.now ? { now: input.now } : {}),
    }),
    namesAmount: namesAmount(body, price, ownerTexts),
    rangeMinor:
      row.range_min_minor === null || row.range_max_minor === null
        ? null
        : { min: Number(row.range_min_minor), max: Number(row.range_max_minor) },
    confirmsCoverage: Boolean(row.coverage_key) && !row.consumed_at,
  };
}

/** The owner's saved answers and closed days, read once for the send check. */
export async function businessFacts(
  sql: Sql,
  businessId: string,
): Promise<{ saved: SavedAnswer[]; closed: ClosedTimes }> {
  const rows = await sql<{ state: string; rule_payload: unknown }>`
    select state, rule_payload from knowledge_item
    where business_id = ${businessId} and rule_payload is not null
  `;
  const details = activeDetails({
    knowledge: rows.map((r) => ({ state: r.state, rulePayload: r.rule_payload })),
  });
  const saved = details.flatMap((d) =>
    d.kind === "answer" && d.text ? [{ topic: d.topic, text: d.text }] : [],
  );
  return { saved, closed: closedTimesOf(details) };
}
