import { HearLetter } from "@/components/enquiry/hear-letter";
import { CountUp, Reveal } from "@/components/site/motion";

const LETTER = `Hi Priya,

I can come to 12 Merthyr Rd on Saturday 19 September.

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

export function ProofCase() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Reveal>
        <article className="rounded-xl bg-raised p-5 shadow-border sm:p-6">
          <p className="eyebrow">The message</p>
          <p className="mt-3 font-serif text-lg leading-relaxed">
            Hi, four of us need makeup on 19 Sep in New Farm, ready by 2. Can you do it and how much?
          </p>
          <p className="mt-4 text-sm text-stone">Priya Shah · Glow & Co · Email</p>
        </article>
      </Reveal>
      <Reveal delay={80}>
        <article className="rounded-xl bg-raised p-5 shadow-border sm:p-6">
          <p className="eyebrow">Already decided</p>
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
                <dd className={"ok" in f && f.ok ? "text-ok" : "strong" in f && f.strong ? "font-medium" : undefined}>
                  {f.d}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 font-serif text-3xl tracking-tight">
            <CountUp to={625} />
          </p>
          <p className="mt-1 text-xs text-stone">Hold $190 · balance on the day · Group Pricing v2</p>
          <div className="mt-4">
            <HearLetter text={LETTER} />
          </div>
        </article>
      </Reveal>
    </div>
  );
}
