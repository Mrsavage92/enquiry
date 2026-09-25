import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { ENQUIRIES } from "../fixtures/enquiries.ts";
import { derivedLabel, nextStepLabel, QUEUE_NAMES, STATUS } from "./labels.ts";
import { rowTimeCue } from "./time-cues.ts";
import { decideEnquiry } from "./decide.ts";
import { snapshotFromDecision } from "./decision-snapshot.ts";
import type { CompositeState } from "./types.ts";

/**
 * One plain status vocabulary (attention plan C13).
 *
 * Every status an owner sees comes from STATUS in labels.ts. These tests fail
 * when a label outside that set appears, or when one of the retired words is
 * written back into an owner-facing screen by hand.
 */

const ALLOWED = new Set<string>(Object.values(STATUS));

test("every derived status is a word from the one vocabulary", () => {
  const lifecycles: CompositeState["lifecycle"][] = [
    "OPEN",
    "BOOKED",
    "DECLINED",
    "LOST",
    "CANCELLED",
  ];
  const decisions: CompositeState["decision"][] = [
    "EVALUATING",
    "NEEDS_INFORMATION",
    "NEEDS_HUMAN",
    "ACTION_READY",
    "WAITING_ON_CLIENT",
    "BOOKING_PENDING",
    "NONE",
  ];
  for (const e of ENQUIRIES) {
    assert.ok(ALLOWED.has(derivedLabel(e.state, e)), `${e.id}: ${derivedLabel(e.state, e)}`);
    for (const lifecycle of lifecycles) {
      for (const decision of decisions) {
        const state = { ...e.state, lifecycle, decision };
        const label = derivedLabel(state, { ...e, state });
        assert.ok(ALLOWED.has(label), `${lifecycle}/${decision}: ${label}`);
      }
    }
  }
});

test("'Needs you' is the queue's name, never a status badge", () => {
  assert.equal(QUEUE_NAMES.needs_you, "Needs you");
  assert.ok(!ALLOWED.has("Needs you"));
});

/** Retired words and the plain word that replaced each. */
const RETIRED: [RegExp, string][] = [
  [/\bAwaiting\b/, "Waiting"],
  [/\bSnooze(d)?\b/, "Later"],
  [/Follow-up ready/, "Follow up"],
  [/Waiting on client/, "Waiting"],
  [/\bNeeds info\b/, "Needs a detail"],
  [/Ready to quote/, "Reply ready"],
  [/\bAt risk\b|\bat risk\b/, "Gone quiet"],
  // Read as a second "Needs you" queue beside the real one.
  [/\b[Nn]eeds? a look\b/, "Gone quiet"],
  [/Autopilot sent/, "(removed: nothing sends by itself)"],
  [/Needs your attention/, "Needs you"],
  // "Waiting" is the customer's turn; the owner's own time cue must not reuse it.
  [/Waiting on you since/, "Your turn since"],
  // Said nothing about what the wait is for.
  [/Nothing until they answer/, "Waiting on Karen - for the number of bedrooms"],
];

/** Owner-facing app code. The public marketing site is owned elsewhere. */
const SCANNED = [
  "src/domain/time-cues.ts",
  "src/domain/labels.ts",
  "src/components/enquiry",
  "src/components/shell",
  "src/components/settings",
  "src/components/bookings",
  "src/components/business",
  "src/components/trust",
  "src/routes/_app",
  "src/routes/onboarding.tsx",
  "src/domain/audit-copy.ts",
  "src/lib/server/workspace.ts",
];

function files(path: string): string[] {
  const full = join(process.cwd(), path);
  if (statSync(full).isFile()) return [full];
  return readdirSync(full).flatMap((name) => files(join(path, name)));
}

/** Strip comments so an explanation of the old word is not flagged as UI copy. */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("no retired status word is hard-coded on an owner-facing screen", () => {
  const hits: string[] = [];
  for (const file of SCANNED.flatMap(files).filter((f) => /\.(tsx?|ts)$/.test(f))) {
    if (/\.test\.tsx?$/.test(file)) continue;
    const lines = code(readFileSync(file, "utf8")).split("\n");
    lines.forEach((line, i) => {
      // Identifiers such as snoozeEnquiry or isSnoozed are code, not copy.
      const copy = line.replace(/\b[a-z]+Snooze[A-Za-z]*\b|\bsnooze[A-Za-z]*\b/g, "");
      for (const [pattern, instead] of RETIRED) {
        if (pattern.test(copy)) hits.push(`${file}:${i + 1} uses ${pattern} - say "${instead}"`);
      }
    });
  }
  assert.deepEqual(hits, []);
});

test("no owner-facing screen or sample says Autopilot", () => {
  const hits: string[] = [];
  for (const file of [...SCANNED, "src/fixtures"].flatMap(files)) {
    if (!/\.(tsx?|ts)$/.test(file) || /\.test\.tsx?$/.test(file)) continue;
    code(readFileSync(file, "utf8"))
      .split("\n")
      .forEach((line, i) => {
        // The stored trust-mode value list is data the server validates, not
        // words anyone reads; every other occurrence is copy.
        if (/"Assist", "Autopilot"\]/.test(line)) return;
        if (/\bAutopilot\b/.test(line)) hits.push(`${file}:${i + 1}`);
      });
  }
  assert.deepEqual(hits, []);
});

test("the tab for customers who went quiet cannot be read as a second 'Needs you'", () => {
  assert.notEqual(QUEUE_NAMES.at_risk, QUEUE_NAMES.needs_you);
  assert.doesNotMatch(QUEUE_NAMES.at_risk, /need/i);
});

test("an enquiry waiting on the owner's prices: the chip and the next step agree", () => {
  const decision = decideEnquiry(
    { knowledge: [] },
    { serviceLabel: "Exterior repaint", facts: [] },
  );
  const snapshot = snapshotFromDecision(decision, { customerName: "Karen Walsh" });
  const base = ENQUIRIES.find((e) => e.state.lifecycle === "OPEN")!;
  const e = {
    ...base,
    atRisk: undefined,
    followUpDue: undefined,
    snoozedUntil: undefined,
    duplicateOf: undefined,
    source: "manual" as const,
    state: { ...base.state, lifecycle: "OPEN" as const, decision: "NEEDS_HUMAN" as const },
    decision: { ...base.decision, ...snapshot },
  };
  assert.equal(nextStepLabel(e), "Add your prices");
  assert.equal(derivedLabel(e.state, e), STATUS.needsPrices);
  assert.ok(ALLOWED.has(derivedLabel(e.state, e)));
});

test("the owner's own time cue says 'Your turn since', not 'Waiting'", () => {
  const e = ENQUIRIES.find(
    (x) =>
      x.state.lifecycle === "OPEN" &&
      x.state.decision === "NEEDS_INFORMATION" &&
      !x.followUpDue &&
      !x.atRisk &&
      !x.snoozedUntil,
  )!;
  const cue = rowTimeCue(e, { timezone: "Australia/Brisbane" } as never);
  assert.match(cue, /^Your turn since /);
  assert.doesNotMatch(cue, /Waiting/);
});

test("saying which service it is reads as one detail, the same word as a missing count", () => {
  const knowledge = [
    {
      state: "Active",
      rulePayload: {
        kind: "fixed_price",
        service: "Exterior repaint",
        amount: 5500,
        currency: "AUD",
      },
    },
  ];
  const base = ENQUIRIES.find((e) => e.state.lifecycle === "OPEN")!;
  const make = (serviceLabel: string, decision: "NEEDS_HUMAN" | "NEEDS_INFORMATION") => ({
    ...base,
    atRisk: undefined,
    followUpDue: undefined,
    snoozedUntil: undefined,
    source: "manual" as const,
    state: { ...base.state, lifecycle: "OPEN" as const, decision },
    decision: {
      ...base.decision,
      ...snapshotFromDecision(decideEnquiry({ knowledge }, { serviceLabel, facts: [] })),
    },
  });
  const chooseService = make("", "NEEDS_HUMAN");
  assert.equal(derivedLabel(chooseService.state, chooseService), STATUS.needsDetail);
  const judgment = {
    ...chooseService,
    decision: {
      ...chooseService.decision,
      recommendation: {
        ...chooseService.decision.recommendation,
        reasonCodes: [],
        label: "Your call on this one",
      },
    },
  };
  assert.equal(derivedLabel(judgment.state, judgment), STATUS.yourCall);
});

test("a waiting row says who it is waiting on and what for", () => {
  const knowledge = [
    {
      state: "Active",
      rulePayload: {
        kind: "per_unit",
        service: "End of lease clean",
        amount: 190,
        currency: "AUD",
        unit: "bedroom",
        quantityField: "bedrooms",
      },
    },
  ];
  const base = ENQUIRIES.find((e) => e.state.lifecycle === "OPEN")!;
  const snap = snapshotFromDecision(
    decideEnquiry({ knowledge }, { serviceLabel: "End of lease clean", facts: [] }),
  );
  const e = {
    ...base,
    customerName: "Karen Walsh",
    nameUnknown: undefined,
    followUpDue: undefined,
    state: {
      ...base.state,
      lifecycle: "OPEN" as const,
      decision: "WAITING_ON_CLIENT" as const,
      commercial: "UNASSESSED" as const,
    },
    decision: { ...base.decision, ...snap },
  };
  assert.equal(nextStepLabel(e), "Waiting on Karen - for the number of bedrooms");
  const unnamed = { ...e, customerName: "Customer", nameUnknown: true };
  assert.equal(nextStepLabel(unnamed), "Waiting on the customer - for the number of bedrooms");
});
