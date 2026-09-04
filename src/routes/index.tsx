import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/site/site-shell";
import { WaitlistForm } from "@/components/site/waitlist-form";
import { LivePhone } from "@/components/site/live-phone";
import { CrossChannelDecisionDemo } from "@/components/site/cross-channel-decision-demo";
import { Button } from "@/components/ui/button";
import { ROADMAP_PREVIEW } from "@/lib/launch/roadmap";
import { HeroIn, Reveal, SiteVideo } from "@/components/site/motion";
import { BrowserFrame, PhoneFrame } from "@/components/site/device-frame";
import { useNarrow } from "@/lib/use-narrow";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "Enquiry - stop managing enquiries" },
      {
        name: "description",
        content:
          "However the enquiry arrives, Enquiry puts the request together, understands what matters for this business, and prepares the next action.",
      },
      { property: "og:image", content: "/product/phone-job.png" },
    ],
  }),
});

function Home() {
  const preview = ROADMAP_PREVIEW;
  const desk = useNarrow(640) === false;

  return (
    <SiteShell>
      <section className="mx-auto max-w-5xl px-5 pb-12 pt-10 sm:pb-20 sm:pt-20">
        <HeroIn>
          <p className="eyebrow">The app</p>
          <span className="page-rule" aria-hidden />
        </HeroIn>
        <HeroIn delay={80}>
          <h1 className="site-hero mt-6 max-w-4xl">Stop managing enquiries.</h1>
        </HeroIn>
        <HeroIn delay={160}>
          <p className="site-lede mt-6 sm:mt-8 sm:text-xl sm:leading-relaxed">
            However the enquiry arrives, Enquiry puts the request together, understands what matters
            for this business, works out what can safely be decided now, and prepares the next
            action.
          </p>
        </HeroIn>
        <HeroIn delay={240}>
          <div className="site-well mt-8 max-w-xl sm:mt-12">
            <WaitlistForm compact ctaVariant="primary-strong" />
          </div>
          <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-sm text-stone">
            Built for service businesses.
            <Link
              to="/enquiries"
              className="inline-flex min-h-11 items-center font-medium text-ink underline-offset-4 hover:underline"
            >
              Open the app
            </Link>
          </p>
        </HeroIn>
      </section>

      <section className="border-t border-line bg-raised/60">
        <div className="mx-auto max-w-5xl px-5 py-14 sm:py-24">
          <CrossChannelDecisionDemo />
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto max-w-5xl px-5 py-12 sm:py-20">
          {/*
            The phone used to float at 304px in the middle of a 984px plate with
            black voids either side. It is now framed as a handset and paired
            with the claim it is evidence for, so the plate carries a product
            shot and an argument instead of one small rectangle.
          */}
          <div className="site-plate px-5 py-10 sm:px-10 sm:py-14">
            <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,25rem)_1fr] lg:gap-16">
              <PhoneFrame className="pointer-events-none mx-auto w-full max-w-[19rem] lg:mx-0 lg:max-w-none">
                <SiteVideo
                  className="block aspect-[9/16] w-full object-cover"
                  src="/product/send-phone.mp4?v=16"
                  poster="/product/poster-phone.jpg"
                  label="Enquiry on a phone. A new enquiry is already understood, and the reply is ready to send."
                />
              </PhoneFrame>

              <div className="text-center lg:text-left">
                <p className="eyebrow text-paper/55">On the phone</p>
                <p className="site-caption mt-3 text-paper">
                  New enquiry. Request understood. Next action prepared.
                </p>
                <ul className="mx-auto mt-7 max-w-sm lg:mx-0 lg:max-w-none">
                  {[
                    "It reads what the customer actually wrote.",
                    "It checks the things this business always checks.",
                    "You read it, and you send it.",
                  ].map((line) => (
                    <li
                      key={line}
                      className="border-t border-white/10 py-3.5 text-sm text-paper/75 last:border-b"
                    >
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto max-w-5xl px-5 py-12 sm:py-20">
          <Reveal>
            <p className="eyebrow">Try it</p>
            <h2 className="site-display mt-3 max-w-2xl">Same job. Already understood. You send.</h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-2">
              One enquiry. Not a gallery of the same screen.
            </p>
          </Reveal>
          <div className="mt-8 sm:hidden">
            <Link
              to="/enquiries/$enquiryId"
              params={{ enquiryId: "f01" }}
              className="flex min-h-16 items-center justify-between gap-4 rounded-xl bg-raised px-4 py-4 shadow-border"
            >
              <div className="min-w-0">
                <p className="commercial-exact font-serif text-2xl tabular-nums tracking-tight">
                  $625
                </p>
                <p className="mt-1 truncate text-sm text-ink-2">Priya Shah · Group mobile makeup</p>
              </div>
              <span className="shrink-0 text-sm font-medium text-mark">Open</span>
            </Link>
            <p className="mt-3 text-sm text-stone">The live app. Next action already prepared.</p>
          </div>
          {desk ? (
            <Reveal delay={80} className="mt-10">
              <LivePhone caption="This is the app. Priya’s next action is ready." />
            </Reveal>
          ) : null}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-12 sm:py-20">
        <Reveal>
          <p className="eyebrow">The problem</p>
          <h2 className="site-display mt-3 max-w-2xl">
            Messy inbound. Then you reconstruct the job from memory.
          </h2>
        </Reveal>
        <ol className="mt-8 max-w-xl space-y-0">
          {[
            "A customer writes in - form, text, Instagram, or mail.",
            "You reconstruct what they want, what matters for this job, and whether you can do it.",
            "You reply. Then you remember to follow up.",
          ].map((line, i) => (
            <Reveal key={line} delay={i * 60}>
              <li className="flex gap-4 border-t border-line py-4 last:border-b">
                <span className="w-6 shrink-0 font-mono text-xs tabular-nums text-stone">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-sm leading-relaxed">{line}</span>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto max-w-5xl px-5 py-12 sm:py-20">
          <Reveal>
            <p className="eyebrow">Who it’s for</p>
            <h2 className="site-display mt-3 max-w-2xl">If customers ask before they book.</h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-2">
              Makeup, photography, painting, consulting - the trade changes. The problem does not: a
              messy request, a decision that depends on how you work, and a next step that should
              not wait.
            </p>
          </Reveal>
          <ul className="mt-10 max-w-xl">
            {["Makeup", "Photography", "Painting", "Consulting"].map((t, i) => (
              <Reveal key={t} delay={i * 50}>
                <li className="border-t border-line py-4 text-sm last:border-b">{t}</li>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto max-w-5xl px-5 py-12 sm:py-20">
          <Reveal>
            <p className="eyebrow">What Enquiry does instead</p>
            <h2 className="site-display mt-3 max-w-2xl">
              It learns the business. Then every enquiry arrives understood.
            </h2>
          </Reveal>
          <ul className="mt-10 grid gap-8 sm:grid-cols-2">
            {[
              {
                title: "Business Brain",
                body: "Services, rules, voice, and prices where they apply - learned from how you actually work. A correction can fix this job, or teach Enquiry the business.",
              },
              {
                title: "The case file",
                body: "Known facts, missing facts, the checks that matter for this request, the next action, and why. Ambiguity stays visible. Enquiry does not guess to fill the gaps.",
              },
              {
                title: "Only the checks that matter",
                body: "Price when price matters. Availability when the date matters. If a check does not apply, it does not appear. Unknown is a valid answer.",
              },
              {
                title: "Prepared, not automatic",
                body: "Enquiry knows the next action and why. Nothing goes out unless that kind of action is allowed. Early access is review-first.",
              },
            ].map((f, i) => (
              <Reveal key={f.title} delay={i * 60}>
                <li className="border-t border-line pt-5">
                  <h3 className="font-serif text-xl font-semibold tracking-tight">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-2">{f.body}</p>
                </li>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {desk ? (
        <section className="border-t border-line">
          {/*
          Wider than the rest of the page on purpose. This capture is the full
          operator desk, and at the 1024px measure the page uses for prose it
          rendered the app at about half scale - every label and line of the
          case file too small to read, which defeats the only thing the shot is
          there to show.
        */}
          <div className="mx-auto max-w-[84rem] px-5 py-12 sm:py-20">
            <Reveal>
              <p className="eyebrow">At the desk</p>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-2">
                Same job. Full case file. The website is here if you sit down.
              </p>
            </Reveal>
            <Reveal>
              <BrowserFrame className="mt-8" url="enquiry.app/enquiries">
                <SiteVideo
                  className="block aspect-video w-full object-cover"
                  src="/product/send.mp4?v=18"
                  poster="/product/poster-desk.jpg"
                  label="The same send on a laptop - full case file, drafted reply, sent."
                />
              </BrowserFrame>
            </Reveal>
          </div>
        </section>
      ) : null}

      <section className="border-t border-line bg-raised">
        <div className="mx-auto max-w-5xl px-5 py-12 sm:py-20">
          <Reveal>
            <p className="eyebrow">What it does not require</p>
          </Reveal>
          <ul className="mt-6 max-w-xl">
            {[
              "A CRM migration",
              "A workflow you have to build",
              "Manual pipeline hygiene",
              "A mailbox, if work arrives as a form or a DM",
            ].map((line, i) => (
              <Reveal key={line} delay={i * 40}>
                <li className="border-t border-line py-4 text-sm last:border-b">{line}</li>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-12 sm:py-20">
        <Reveal>
          <p className="eyebrow">Early access</p>
          <h2 className="site-display mt-3 max-w-2xl">We’re starting small.</h2>
          <p className="mt-3 max-w-xl text-sm text-ink-2">
            Access opens gradually so we can work closely with the first businesses and make Enquiry
            trustworthy before opening it more widely.
          </p>
        </Reveal>
        <ol className="mt-8 max-w-xl">
          {[
            {
              t: "Join with an email",
              b: "Optional questions help us invite the right businesses first.",
            },
            {
              t: "We invite in small groups",
              b: "As the product is ready - not as a countdown or a queue position.",
            },
            {
              t: "You open the app",
              b: "Review the next action, then send. Enquiry is intended to become a paid product. We’ll share pricing before any paid access begins.",
            },
          ].map((s, i) => (
            <Reveal key={s.t} delay={i * 60}>
              <li className="flex gap-4 border-t border-line py-5 last:border-b">
                <span className="w-6 shrink-0 font-mono text-xs tabular-nums text-stone">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="font-medium">{s.t}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-2">{s.b}</p>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto max-w-5xl px-5 py-12 sm:py-20">
          <Reveal>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Roadmap</p>
                <h2 className="site-display mt-3">What’s in motion</h2>
              </div>
              <Button variant="secondary" asChild>
                <Link to="/roadmap">Full roadmap</Link>
              </Button>
            </div>
          </Reveal>
          <ul className="mt-8 divide-y divide-line border-y border-line">
            {preview.map((item, i) => (
              <Reveal key={item.id} delay={i * 50}>
                <li className="py-5">
                  <p className="text-xs uppercase tracking-wider text-stone">{item.statusLabel}</p>
                  <p className="mt-1 font-medium">{item.title}</p>
                  <p className="mt-1 text-sm text-ink-2">{item.lede}</p>
                </li>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto max-w-5xl px-5 py-12 sm:py-20">
          <Reveal>
            <h2 className="site-display max-w-2xl">
              The enquiries aren’t going to decide themselves.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-2">
              Join early access. Open the app to see the product case file. We’re building for
              service businesses - makeup, photography, painting, consulting - because someone
              interested still has to become booked, or lost, without you reconstructing every job
              by hand.
            </p>
            <div className="site-well mt-8 max-w-xl">
              <WaitlistForm compact ctaLabel="Request early access" />
            </div>
          </Reveal>
        </div>
      </section>
    </SiteShell>
  );
}
