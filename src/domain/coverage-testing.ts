import { COVERAGE_FIELD } from "./coverage.ts";
import { decideEnquiry, type Decision } from "./decide.ts";

type DecideArgs = Parameters<typeof decideEnquiry>;

/**
 * For tests: decide as the owner would after pressing "That's everything" on
 * exactly the coverage the decision showed. Anything that is not priced is
 * returned as decided.
 */
export function decideConfirmed(business: DecideArgs[0], enquiry: DecideArgs[1]): Decision {
  const first = decideEnquiry(business, enquiry);
  if (!first.coverage || first.coverage.confirmed) return first;
  const facts = [
    ...(enquiry.facts ?? []),
    { field: COVERAGE_FIELD, value: first.coverage.key, status: "confirmed" },
  ];
  return decideEnquiry(business, { ...enquiry, facts: facts as never });
}
