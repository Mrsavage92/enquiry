import assert from "node:assert/strict";
import test from "node:test";
import { BENCHMARK_CASES } from "./cases.ts";
import { runCase, toVariantCase } from "./db.ts";
import type { RunMode } from "./db.ts";
import { FORBIDDEN_PROMISES } from "../../domain/edit-warnings.ts";
import { enquiry, freshDb, row, settle, tell, tenant } from "../../lib/repo/pass8-db-helpers.ts";

/**
 * Trust pass 11: the app never promises availability in a reply it writes.
 * Every composed reply on the whole benchmark corpus (each case in `null` and
 * `fake` mode, and its follow-ups), and on the review's own enquiries, is
 * scanned for "I'll work around that", "you're booked", "I'll fit you in",
 * "no problem" and the rest. The app may only say what the customer said,
 * "I'll confirm whether that works", the days the owner does not work, and
 * the deadlines it heard.
 */

function scan(label: string, body: string) {
  for (const re of FORBIDDEN_PROMISES) assert.doesNotMatch(body, re, `${label}: ${body}`);
}

for (const mode of ["null", "fake"] as RunMode[]) {
  test(`every benchmark reply in ${mode} mode is free of availability promises`, async () => {
    const cases = BENCHMARK_CASES.flatMap((k) => {
      const variant = toVariantCase(k);
      return variant ? [k, variant] : [k];
    });
    let scanned = 0;
    for (const kase of cases) {
      const run = await runCase(kase, mode);
      if (run.kind !== "ran") continue;
      scan(kase.id, run.enquiryAfterInterpretation.decision_snapshot.draft.body);
      for (const f of run.followUps)
        scan(`${kase.id} ${f.label}`, f.enquiry.decision_snapshot.draft.body);
      scanned += 1;
      await run.pg.close();
    }
    assert.equal(scanned, cases.length, "every case ran");
  });
}

const DANA = [
  "Regular house clean is $55 an hour, minimum 3 hours",
  "End of lease clean 2 bedroom $380",
  "End of lease clean 3 bedroom $480",
  "Oven clean $60",
  "Fridge clean $40",
  "Inside windows $8 per window",
  "Weekend jobs have a 20% surcharge",
  "Interior painting $32 per sqm, minimum charge $600",
  "Bridal makeup $250",
  "Bridesmaid makeup $140 each",
  "Makeup trial $90",
  "We don't work Sundays",
  "Closed 24 December to 4 January",
  "We don't do exterior painting",
  "We have $10 million public liability insurance",
].join("\n");

/** The review's own enquiries (adhd-review-8), each with the service the owner confirms. */
const REVIEW: [string, string][] = [
  [
    "hey there!! need an end of lease clean for my 3 bed unit in Chermside, moving out Fri 16th Oct. can u also do the oven + fridge?? how much all up. cheers Mel",
    "End of lease clean 3 bedroom",
  ],
  [
    "EOL clean 2br unit, settlement 28/12 so need it done 27th or 28th. oven too. $$? ta Jase",
    "End of lease clean 2 bedroom",
  ],
  [
    "Hi, we need an end of lease clean for a 2 bedroom apartment. Our lease ends Sunday 27 December so it would need to be the 26th or 27th. Could you also do the inside windows, there are 10. Thanks, Ahmed",
    "End of lease clean 2 bedroom",
  ],
  [
    "G'day, looking to get the kitchen walls painted, it's only small, 15 square metres. Could you do Sunday 11 October? Cheers, Rob Kelly",
    "Interior painting",
  ],
  [
    "Hi, we settle on Saturday 2 January and would love the place painted that day or the 3rd before furniture arrives, approx 90 square metres. Is that doable? Priyanka & Dev",
    "Interior painting",
  ],
  [
    "Hi! I'm getting married Sunday 20th December and need bridal makeup. Just me, no bridesmaids. Chloe xoxo",
    "Bridal makeup",
  ],
  [
    "hi hun r u free mon 12/10 for bridal makeup for my sisters wedding? not the bride, i'm a bridesmaid, me + mum need makeup. in Redcliffe. thx bec",
    "Bridesmaid makeup",
  ],
];

test("every reply on the review's own enquiries is free of availability promises", async (t) => {
  const pg = await freshDb(t);
  const a = await tenant(pg, "user-a", "Dana Clean");
  await tell(pg, a.businessId, DANA);
  for (const [message, service] of REVIEW) {
    const e = await enquiry(pg, a.businessId, message, service);
    scan(service, (await row(pg, e.enquiryId)).decision_snapshot.draft.body);
    await settle(pg, e.enquiryId);
    scan(service, (await row(pg, e.enquiryId)).decision_snapshot.draft.body);
  }
});
