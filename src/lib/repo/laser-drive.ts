import assert from "node:assert/strict";
import type { PGlite } from "@electric-sql/pglite";
import type { Enquiry } from "../../domain/types.ts";
import { laserNext, replyText, type LaserNext } from "../../domain/laser.ts";
import { promiseVerdict } from "../../domain/labels.ts";
import { EXTRA_CHOICE, extraField } from "../../domain/extras.ts";
import { QUESTION_ANSWER } from "../../domain/service-questions.ts";
import { ASK_CHOICE, availabilityValue } from "../../domain/customer-asks.ts";
import { warningsKey } from "../../domain/edit-warnings.ts";
import { loadWorkspace } from "./workspace.server.ts";
import { confirmCoverageForUser } from "./coverage-core.ts";
import {
  prepareReviewedSendInTransaction,
  type PrepareReviewResult,
} from "./reviewed-send-core.ts";
import { confirmReviewedSendInTransaction } from "./sent-reply-core.ts";
import { applyPracticeSampleInTransaction } from "./practice-core.ts";
import { answer, sqlFor, tell, tx } from "./pass8-db-helpers.ts";
import { applyDecision, lockEnquiry } from "./decision-apply.ts";
import { holdingItems } from "../../domain/asked.ts";

/** The owner saying which service it is: the same writes as `setEnquiryService`. */
async function confirmService(pg: PGlite, enquiryId: string, serviceLabel: string) {
  await tx(pg, async (sql) => {
    const locked = await lockEnquiry(sql, enquiryId);
    assert.ok(locked);
    await sql`
      update enquiry_fact set superseded = true, updated_at = now()
      where enquiry_id = ${enquiryId} and lower(field) = ${"service"} and superseded = false
    `;
    await sql`
      insert into enquiry_fact
        (enquiry_id, field, label, value, display_value, status, confidence,
         asserted_by, provenance, customer_specific)
      values (${enquiryId}, ${"service"}, ${"service"}, ${serviceLabel}, ${serviceLabel},
        ${"confirmed"}, ${"High"}, ${"user"}, ${JSON.stringify({ kind: "user" })}::jsonb, ${true})
    `;
    await sql`update enquiry set service_label = ${serviceLabel} where id = ${enquiryId}`;
    return applyDecision(sql, {
      enquiryId,
      businessId: locked.businessId,
      serviceLabel,
      customerName: locked.customerName,
    });
  });
}

/**
 * Drives one enquiry from the screen opening to a recorded send, the way the
 * owner does on the laser screen: each step taps the one filled button the
 * screen model names (or the one choice a card with no filled button needs),
 * through the real server functions, and counts the taps. Typing, scrolling
 * and waiting are not taps (doc 50 section 4).
 */

export type Step = { tap: string; verdict: string; next: LaserNext["kind"] };

export type DriveResult = {
  /** Taps from open to the recorded send. */
  taps: number;
  /** Owner decisions on the way (taps that are not Copy, Yes or the review panel). */
  decisions: number;
  /** One line per tap, for the PR's tap table. */
  steps: Step[];
  /** The verdict and the filled button on first render. */
  first: { verdict: string; primary: string | null; next: LaserNext };
  /** The recorded reply. */
  body: string;
  prepared?: PrepareReviewResult;
};

export type DriveOptions = {
  /** Prices the owner saves on the pricing screen when the step sends them there. */
  prices?: string;
  /** The reply the owner leaves on screen before Copy (an edit). */
  edit?: (body: string) => string;
  /** What the owner does with a refused reply: the fix tap. */
  onRefused?: (res: Extract<PrepareReviewResult, { ok: false }>, body: string) => string;
  /** Answers by fact field, for a question the default choice does not fit. */
  answers?: Record<string, string>;
  /** The service the owner names when the screen asks which one it is. */
  service?: string;
};

export async function loadEnquiry(pg: PGlite, enquiryId: string, userId = "user-a") {
  const ws = await loadWorkspace(userId, sqlFor(pg) as never);
  const enquiry = ws.enquiries.find((e) => e.id === enquiryId);
  assert.ok(enquiry, "the enquiry loads for its owner");
  const business = ws.businesses.find((b) => b.id === enquiry.businessId);
  return { enquiry, business };
}

function primaryOf(next: LaserNext): string | null {
  if (next.kind === "decide") return next.primary;
  if (next.kind === "prices" || next.kind === "send") return next.label;
  return null;
}

/** The owner's tap for one open decision, through the server function it calls. */
async function decide(
  pg: PGlite,
  e: Enquiry,
  next: Extract<LaserNext, { kind: "decide" }>,
  opts: DriveOptions,
): Promise<string> {
  const d = e.decision;
  const typed = (field: string) => opts.answers?.[field];
  switch (next.decision) {
    case "question_service": {
      const q = d.questionPending!;
      const value =
        typed(q.field) ?? (q.readAs === "no" ? QUESTION_ANSWER.no : QUESTION_ANSWER.yes);
      await answer(pg, "user-a", e.id, q.field, value);
      if (value === QUESTION_ANSWER.no) return `No, I don't do ${q.thing}`;
      if (value === QUESTION_ANSWER.yes) return `Yes, I do ${q.thing}`;
      return next.primary ?? value;
    }
    case "question_availability": {
      const q = d.questionPending!;
      const days = q.days ?? [];
      const value =
        typed(q.field) ??
        (days.length
          ? availabilityValue(days.map((day) => [day.iso, day.closed ? "no" : "yes"]))
          : "yes");
      await answer(pg, "user-a", e.id, q.field, value);
      return days.length > 1 ? "Yes, free on all of them" : "Yes, I'm free";
    }
    case "question_ask": {
      const q = d.questionPending!;
      const value = typed(q.field) ?? q.saved ?? ASK_CHOICE.later;
      await answer(pg, "user-a", e.id, q.field, value);
      return next.primary ?? "Come back to them";
    }
    case "extra": {
      const extra = d.extraPending!;
      const value =
        typed(extra.field) ??
        (extra.kind === "check" ? EXTRA_CHOICE.include : EXTRA_CHOICE.comeBack);
      await answer(pg, "user-a", e.id, extra.field, value);
      return next.primary ?? "Tell them I'll come back on it";
    }
    case "rule": {
      const flag = d.coverage!.flagged.find((f) => f.thing && f.check)!;
      await answer(pg, "user-a", e.id, flag.check!.field, flag.check!.choices[0]![0]);
      return next.primary ?? flag.check!.choices[0]![1];
    }
    case "flag": {
      const flag = d.coverage!.flagged.find((f) => f.thing)!;
      const field = extraField(flag.thing!.toLowerCase());
      await answer(
        pg,
        "user-a",
        e.id,
        typed(field) ? field : field,
        typed(field) ?? EXTRA_CHOICE.covered,
      );
      return "Part of this price";
    }
    case "coverage": {
      const res = await confirmCoverageForUser(sqlFor(pg), (fn) => tx(pg, fn), "user-a", {
        enquiryId: e.id,
        key: d.coverage!.key,
        revision: e.decisionRevision ?? -1,
      });
      assert.equal(res.ok, true, JSON.stringify(res));
      return "That's everything";
    }
    case "reading": {
      const m = d.missing.find((x) => x.blocking)!;
      await answer(pg, "user-a", e.id, m.factField, m.inferred!.value);
      return next.primary!;
    }
    case "estimate": {
      const m = d.missing.find((x) => x.blocking)!;
      await answer(pg, "user-a", e.id, m.factField, typed(m.factField) ?? "3");
      return "Confirm";
    }
    case "asked": {
      const item = holdingItems(d.asked ?? [])[0]!;
      // An extra with a saved price is added (the filled button); anything else is come back on.
      const value =
        typed(item.id) ??
        (next.primary
          ? EXTRA_CHOICE.include
          : item.kind === "extra"
            ? EXTRA_CHOICE.comeBack
            : item.kind === "question"
              ? QUESTION_ANSWER.later
              : ASK_CHOICE.later);
      await answer(pg, "user-a", e.id, item.id, value);
      return `${item.text}: ${next.primary ?? "come back to them"}`;
    }
    case "choose_service":
    case "confirm_service": {
      const label = opts.service ?? d.provisionalPrice?.service ?? d.conflicts[0] ?? e.serviceLabel;
      assert.ok(label, "a service to name");
      await confirmService(pg, e.id, label);
      return `This is ${label}`;
    }
    default:
      throw new Error(`No owner tap is scripted for a ${next.decision} step.`);
  }
}

/** Copy, then Yes: through the real prepare and confirm, never a client body recorded. */
async function copyAndRecord(
  pg: PGlite,
  e: Enquiry,
  opts: DriveOptions,
  steps: Step[],
  verdict: string,
): Promise<{ body: string; prepared: PrepareReviewResult; taps: number }> {
  let body = replyText(e, opts.edit ? opts.edit(replyText(e, undefined)) : undefined);
  let taps = 0;
  const prepare = (text: string) =>
    tx(pg, (sql) =>
      prepareReviewedSendInTransaction(sql, {
        enquiryId: e.id,
        businessId: e.businessId,
        userId: "user-a",
        body: text,
        channel: "manual",
      }),
    );
  // The check runs before the tap. A refusal shows its fix; the fix is one tap.
  let prepared = await prepare(body);
  for (let i = 0; i < 3 && !prepared.ok; i += 1) {
    assert.ok(opts.onRefused, `refused with no fix scripted: ${JSON.stringify(prepared)}`);
    body = opts.onRefused(prepared, body);
    taps += 1;
    steps.push({ tap: "Use the prepared total", verdict, next: "send" });
    prepared = await prepare(body);
  }
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  if (!prepared.ok) throw new Error("unreachable");
  taps += 1;
  steps.push({
    tap: prepared.warnings.length ? "Copy anyway" : "Copy",
    verdict,
    next: "send",
  });
  const recorded = await tx(pg, (sql) =>
    confirmReviewedSendInTransaction(sql, {
      reviewedSendId: prepared.reviewedSendId,
      enquiryId: e.id,
      businessId: e.businessId,
      userId: "user-a",
      ...(prepared.warnings.length ? { acknowledgedWarnings: warningsKey(prepared.warnings) } : {}),
    }),
  );
  assert.equal(recorded.ok, true, JSON.stringify(recorded));
  taps += 1;
  steps.push({ tap: "Yes, I sent it", verdict, next: "send" });
  return { body, prepared, taps };
}

/** From the screen opening to the recorded send (or, for practice, to Yes). */
export async function drive(
  pg: PGlite,
  enquiryId: string,
  opts: DriveOptions = {},
): Promise<DriveResult> {
  const steps: Step[] = [];
  let taps = 0;
  let decisions = 0;
  let first: DriveResult["first"] | undefined;
  for (let i = 0; i < 24; i += 1) {
    const { enquiry: e, business } = await loadEnquiry(pg, enquiryId);
    const next = laserNext(e, { business });
    const verdict = promiseVerdict(e).line;
    first ??= { verdict, primary: primaryOf(next), next };
    if (next.kind === "decide") {
      const tap = await decide(pg, e, next, opts);
      taps += 1;
      decisions += 1;
      steps.push({ tap, verdict, next: next.kind });
      continue;
    }
    if (next.kind === "prices") {
      taps += 1;
      decisions += 1;
      if (next.practice) {
        const res = await tx(pg, (sql) =>
          applyPracticeSampleInTransaction(sql, { businessId: e.businessId, enquiryId: e.id }),
        );
        assert.equal(res.ok, true, JSON.stringify(res));
        steps.push({ tap: "Use a sample price for practice", verdict, next: next.kind });
      } else {
        assert.ok(opts.prices, "the pricing screen needs prices to save");
        // The pricing screen's own taps (P) are the same in both builds and are not counted.
        await tell(pg, e.businessId, opts.prices);
        steps.push({ tap: `${next.label} (+P on the pricing screen)`, verdict, next: next.kind });
      }
      continue;
    }
    assert.equal(next.kind, "send", `stuck on ${next.kind}: ${verdict}`);
    if (next.kind !== "send") throw new Error("unreachable");
    if (next.review) {
      taps += 1;
      steps.push({ tap: `${next.label} (opens the review panel)`, verdict, next: next.kind });
    }
    if (e.practice) {
      // Client-only path: Copy writes the text, Yes says "Practice - nothing recorded".
      steps.push({ tap: next.label, verdict, next: next.kind });
      steps.push({ tap: "Yes, I sent it", verdict, next: next.kind });
      return { taps: taps + 2, decisions, steps, first: first!, body: replyText(e, undefined) };
    }
    const sent = await copyAndRecord(pg, e, opts, steps, verdict);
    return {
      taps: taps + sent.taps,
      decisions: decisions + (sent.taps - 2),
      steps,
      first: first!,
      body: sent.body,
      prepared: sent.prepared,
    };
  }
  throw new Error("the enquiry never reached a send");
}
