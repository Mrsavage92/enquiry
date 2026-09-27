import { COVERAGE_FIELD, RECURRING_FIELD, unsettledFlags, type CoverageFlag } from "./coverage.ts";
import { decideEnquiry, type Decision } from "./decide.ts";
import { EXTRA_CHOICE, extraField } from "./extras.ts";
import { QUESTION_ANSWER, questionField } from "./service-questions.ts";

type DecideArgs = Parameters<typeof decideEnquiry>;

/**
 * For tests: the fact an owner writes to settle one flag the plainest way -
 * something mentioned is part of this price, something not offered is a No,
 * a frequency is right.
 */
export function settlingFact(flag: CoverageFlag): { field: string; value: string } {
  const thing = (flag.thing ?? "").toLowerCase();
  if (flag.kind === "recurring") return { field: RECURRING_FIELD, value: "yes" };
  if (flag.kind === "rule" && flag.check) {
    return { field: flag.check.field, value: flag.check.choices[0]![0] };
  }
  if (flag.kind === "not_offered")
    return { field: questionField(thing), value: QUESTION_ANSWER.no };
  return { field: extraField(thing), value: EXTRA_CHOICE.covered };
}

/**
 * For tests: decide as the owner would after settling every flag and pressing
 * "That's everything" on exactly the coverage the decision then showed.
 * Anything that is not priced is returned as decided.
 */
export function decideConfirmed(business: DecideArgs[0], enquiry: DecideArgs[1]): Decision {
  let facts = [...(enquiry.facts ?? [])] as { field: string; value: string; status: string }[];
  let d = decideEnquiry(business, { ...enquiry, facts: facts as never });
  for (let i = 0; i < 5 && d.coverage && unsettledFlags(d.coverage.flagged).length; i += 1) {
    const settled = unsettledFlags(d.coverage.flagged).map((f) => ({
      ...settlingFact(f),
      status: "confirmed",
    }));
    facts = [...facts, ...settled];
    d = decideEnquiry(business, { ...enquiry, facts: facts as never });
  }
  if (!d.coverage || d.coverage.confirmed) return d;
  facts = [...facts, { field: COVERAGE_FIELD, value: d.coverage.key, status: "confirmed" }];
  return decideEnquiry(business, { ...enquiry, facts: facts as never });
}
