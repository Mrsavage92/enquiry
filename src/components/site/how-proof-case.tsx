import { CountUp } from "@/components/site/motion";
import { MediaFrame } from "@/components/site/device-frame";
import { HearLetter } from "@/components/enquiry/hear-letter";

const LETTER = `Hi Priya,

I can come to your New Farm address on Saturday 19 September.

Makeup for four of you is $625 including travel. I'll plan to start around 10:45am so everyone is ready by 2pm.

If you'd like to hold the date, a $190 booking fee does that and the balance is on the day.

Mina
Glow & Co`;

const FACTS = [
  { t: "They want", d: "Group mobile makeup · 4 · 19 Sep · New Farm" },
  { t: "Known", d: "Travel within 15 km · dressed-up" },
  { t: "Missing", d: "Nothing blocking", ok: true },
  { t: "Checks", d: "Price exact · capacity free" },
  { t: "Next", d: "Send the quote", strong: true },
] as const;

/**
 * `/how`'s pricing case, rebuilt on the mirror system in place of the
 * shared `ProofCase` (which still carries `font-serif` and `Reveal`, both
 * forbidden on this route - system.md §5.2 and `forbidden_additions`).
 * Copy, facts and the `HearLetter` playback are unchanged.
 *
 * This is a recreation of real product output, the same category as
 * `CrossChannelDecisionDemo` - so per system.md §5.3 it sits inside
 * `MediaFrame` + `.mk-app-surface`, showing the product's own light
 * palette rather than an inverted, unverified dark version of it.
 */
export function HowProofCase() {
  return (
    <section className="mk-section">
      <div className="mk-container">
        <div className="mk-section-head">
          <p className="mk-label">When the price can be decided</p>
          <h2 className="mk-h2 mt-4 max-w-2xl">A different job. Exact quote, ready to send.</h2>
          <p className="mk-lede mt-5 max-w-xl">
            Some enquiries resolve to a number. That is still Enquiry - it is not the whole product.
          </p>
        </div>
      </div>
      <div className="mk-page">
        <MediaFrame>
          <div className="mk-app-surface grid gap-4 p-5 sm:p-8 lg:grid-cols-2">
            <article className="rounded-xl bg-raised p-5 shadow-border sm:p-6">
              <p className="eyebrow">Sample message</p>
              <p className="mt-3 text-lg leading-relaxed">
                Hi, four of us need makeup on 19 Sep in New Farm, ready by 2. Can you do it and how
                much?
              </p>
              <p className="mt-4 text-sm text-stone">Priya Shah · Sample enquiry · Email</p>
            </article>
            <article className="rounded-xl bg-raised p-5 shadow-border sm:p-6">
              <p className="eyebrow">Sample decision</p>
              <dl className="mt-4 space-y-3 text-sm">
                {FACTS.map((f, i) => (
                  <div
                    key={f.t}
                    className={
                      i === FACTS.length - 1
                        ? "flex justify-between gap-3"
                        : "flex justify-between gap-3 border-b border-line pb-2"
                    }
                  >
                    <dt className="text-stone">{f.t}</dt>
                    <dd
                      className={
                        "ok" in f && f.ok
                          ? "text-mark"
                          : "strong" in f && f.strong
                            ? "font-medium"
                            : undefined
                      }
                    >
                      {f.d}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-5 text-3xl font-semibold tracking-tight">
                <CountUp to={625} />
              </p>
              <p className="mt-1 text-xs text-stone">
                Hold $190 · balance on the day · Group Pricing v2
              </p>
              <div className="mt-4">
                <HearLetter text={LETTER} />
              </div>
            </article>
          </div>
        </MediaFrame>
      </div>
    </section>
  );
}
