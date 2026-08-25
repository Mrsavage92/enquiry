import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/site/site-shell";
import { WaitlistForm } from "@/components/site/waitlist-form";
import { LivePhone } from "@/components/site/live-phone";
import { Button } from "@/components/ui/button";
import { ROADMAP_PREVIEW } from "@/lib/launch/roadmap";
import { HeroIn, Reveal, SiteVideo } from "@/components/site/motion";
import { useNarrow } from "@/lib/use-narrow";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "Enquiry — stop managing enquiries" },
      {
        name: "description",
        content:
          "Enquiry learns how your business works, understands what every customer is asking for and works out what needs to happen next.",
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
      <section className="mx-auto max-w-5xl px-5 pb-10 pt-10 sm:pb-24 sm:pt-28">
        <HeroIn>
          <p className="eyebrow">The app</p>
        </HeroIn>
        <HeroIn delay={80}>
          <h1 className="site-hero mt-4 max-w-4xl">Stop managing enquiries.</h1>
        </HeroIn>
        <HeroIn delay={160}>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-2 sm:mt-7 sm:text-xl">
            Enquiry learns how your business works, understands what every customer is asking for and
            works out what needs to happen next. On the phone, between jobs. You approve. You send.
          </p>
        </HeroIn>
        <HeroIn delay={240}>
          <div className="mt-8 max-w-xl sm:mt-10">
            <WaitlistForm compact />
          </div>
          <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-stone">
            Building with service businesses.
            <Link
              to="/enquiries"
              className="inline-flex min-h-11 items-center font-medium text-ink underline-offset-4 hover:underline"
            >
              Open the app
            </Link>
          </p>
        </HeroIn>
      </section>

      <section className="site-film border-t border-line bg-ink">
        <div className="pointer-events-none mx-auto flex justify-center px-5 py-8 sm:py-14">
          <SiteVideo
            className="aspect-[9/16] w-[min(100%,18.5rem)] rounded-2xl object-cover shadow-float sm:w-[min(100%,22rem)]"
            src="/product/send-phone.mp4?v=15"
            poster="/product/poster-phone.jpg"
            label="A woman opens Enquiry on her phone. A new enquiry is already drafted. She sends the quote."
          />
        </div>
        <div className="mx-auto max-w-6xl px-5 pb-8">
          <p className="text-center text-sm text-paper/70">New enquiry. Reply already written. Sent.</p>
        </div>
      </section>

      <section className="border-t border-line bg-paper-2">
        <div className="mx-auto max-w-5xl px-5 py-10 sm:py-16">
          <Reveal>
            <p className="eyebrow">Try it</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight">
              Same job. On the phone. You send.
            </h2>
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
                <p className="commercial-exact font-serif text-2xl tabular-nums tracking-tight">$625</p>
                <p className="mt-1 truncate text-sm text-ink-2">Priya Shah · Group mobile makeup</p>
              </div>
              <span className="shrink-0 text-sm font-medium text-mark">Open</span>
            </Link>
            <p className="mt-3 text-sm text-stone">The live app. Quote already drafted.</p>
          </div>
          {desk ? (
            <Reveal delay={80} className="mt-10">
              <LivePhone />
            </Reveal>
          ) : null}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-10 sm:py-16">
        <Reveal>
          <p className="eyebrow">The problem</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight">
            Messy inbound. Then you reconstruct the job from memory.
          </h2>
        </Reveal>
        <ol className="mt-8 max-w-xl space-y-0">
          {[
            "A customer writes in — form, text, Instagram, or mail.",
            "You reconstruct what they want, what you charge, and whether you can do it.",
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
        <div className="mx-auto max-w-5xl px-5 py-10 sm:py-16">
          <Reveal>
            <p className="eyebrow">Who it’s for</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight">
              The shape of the enquiry is the product. Not the niche.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-2">
              Makeup today. Photography tomorrow. Painting the day after. Same object: a messy
              message, a number, a letter, send.
            </p>
          </Reveal>
          <ul className="mt-10 max-w-xl">
            {["Makeup", "Photography", "Painting", "Cleaning"].map((t, i) => (
              <Reveal key={t} delay={i * 50}>
                <li className="border-t border-line py-4 text-sm last:border-b">{t}</li>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto max-w-5xl px-5 py-10 sm:py-16">
          <Reveal>
            <p className="eyebrow">What Enquiry does instead</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight">
              It learns the business. Then every enquiry arrives understood.
            </h2>
          </Reveal>
          <ul className="mt-10 grid gap-8 sm:grid-cols-2">
            {[
              {
                title: "Business Brain",
                body: "Services, prices, rules and voice — learned from how you actually work. A correction can fix this job, or teach Enquiry the business.",
              },
              {
                title: "The case file",
                body: "Known facts, missing facts, the checks that matter, the next action, and why. You approve. You send.",
              },
              {
                title: "The quote is a document",
                body: "Not a number in a chat. Editing the letter does not change the figure on file.",
              },
              {
                title: "On the phone, and at the desk",
                body: "Today, a job, send — when you’re on your feet. The same product on a computer is the full case file.",
              },
            ].map((f, i) => (
              <Reveal key={f.title} delay={i * 60}>
                <li>
                  <h3 className="text-lg font-semibold tracking-tight">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-2">{f.body}</p>
                </li>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {desk ? (
      <section className="site-film border-t border-line bg-ink">
        <div className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
          <Reveal>
            <p className="eyebrow text-paper/50">At the desk</p>
            <p className="mt-2 max-w-xl text-sm text-paper/70">
              Same job. Full case file. The website is here if you sit down.
            </p>
          </Reveal>
          <SiteVideo
            className="mt-8 aspect-video w-full object-cover"
            src="/product/send.mp4?v=14"
            poster="/product/poster-desk.jpg"
            label="The same send on a laptop — full case file, drafted reply, sent."
          />
        </div>
      </section>
      ) : null}

      <section className="border-t border-line bg-raised">
        <div className="mx-auto max-w-5xl px-5 py-10 sm:py-16">
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

      <section className="mx-auto max-w-5xl px-5 py-10 sm:py-16">
        <Reveal>
          <p className="eyebrow">How we roll out access</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight">
            Small cohorts. No fake scarcity.
          </h2>
          <p className="mt-3 max-w-xl text-sm text-ink-2">
            Preparing Cohort 1 — five businesses. Fit over queue position. We only invite the number
            the product and support can absorb.
          </p>
        </Reveal>
        <ol className="mt-8 max-w-xl">
          {[
            {
              t: "Reserve a place",
              b: "Join early access with an email. Optional questions help us invite the right businesses first.",
            },
            {
              t: "We invite in cohorts",
              b: "Five, then about twenty, then more — only as many as the product and support can absorb.",
            },
            {
              t: "You open the app",
              b: "Business Brain, first enquiry, you send. Founding-user pricing only if we later know it is real.",
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
        <div className="mx-auto max-w-5xl px-5 py-10 sm:py-16">
          <Reveal>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Roadmap</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight">What’s in motion</h2>
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
                  <p className="text-xs uppercase tracking-wider text-stone">
                    {item.statusLabel}
                  </p>
                  <p className="mt-1 font-medium">{item.title}</p>
                  <p className="mt-1 text-sm text-ink-2">{item.lede}</p>
                </li>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto max-w-5xl px-5 py-10 sm:py-16">
          <Reveal>
            <h2 className="max-w-2xl text-3xl font-semibold tracking-tight">
              The enquiries aren’t going to quote themselves.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-2">
              Join early access. Open the app when you want to see a real case file. We’re building
              with service businesses — makeup, photography, painting, cleaning — because the shape of
              the enquiry is the product, not the niche.
            </p>
            <div className="mt-8 max-w-xl">
              <WaitlistForm compact />
            </div>
          </Reveal>
        </div>
      </section>
    </SiteShell>
  );
}
