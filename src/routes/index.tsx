import { createFileRoute, Link } from "@tanstack/react-router";
import { socialHead } from "@/lib/site/head";
import { SiteShell } from "@/components/site/site-shell";
import { WaitlistForm } from "@/components/site/waitlist-form";
import { LivePhone } from "@/components/site/live-phone";
import { CrossChannelDecisionDemo } from "@/components/site/cross-channel-decision-demo";
import { SIGNATURE_DEMO } from "@/lib/site/signature-demo";
import { ROADMAP_PREVIEW } from "@/lib/launch/roadmap";
import { SiteVideo } from "@/components/site/motion";
import { MediaFrame } from "@/components/site/device-frame";
import { useNarrow } from "@/lib/use-narrow";

export const Route = createFileRoute("/")({
  component: Home,
  head: () =>
    socialHead({
      path: "/",
      title: "Enquiry - stop managing enquiries",
      description:
        "However the enquiry arrives, Enquiry puts the request together, understands what matters for this business, and prepares the next action.",
    }),
});

function Home() {
  const preview = ROADMAP_PREVIEW;
  const narrowState = useNarrow(640);
  const desk = narrowState === false;
  const mounted = narrowState !== null;

  return (
    <SiteShell>
      {/*
        Above the fold, in the reference's order: headline, lede row, product
        visual. The reference's lede row puts a secondary item at its right
        edge, which is where "Built for service businesses / See demo" now
        sits. The waitlist form is the one addition - the reference's hero has
        no form, and Enquiry's primary action is an email capture.
      */}
      <section className="mk-container pt-[120px] pb-14 sm:pt-[152px]">
        <p className="mk-label">The app</p>
        <h1 className="mk-h1 mt-6 max-w-[18ch]">Stop managing enquiries.</h1>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-10">
          <p className="mk-lede max-w-xl">
            However the enquiry arrives, Enquiry puts the request together, understands what matters
            for this business, works out what can safely be decided now, and prepares the next
            action.
          </p>
          <p className="mk-mini flex shrink-0 flex-wrap items-center gap-x-2">
            Built for service businesses.
            <Link to="/demo" className="mk-nav-link px-0 text-[var(--mk-fg)]">
              See demo
            </Link>
          </p>
        </div>
        <div className="mt-8 max-w-xl">
          <WaitlistForm compact ctaVariant="primary-strong" />
        </div>
      </section>

      {/*
        The product visual. The reference runs its app capture full width
        directly under the hero, on a plate wider than the text column. The
        widget's own header copy stays outside the plate - the reference never
        puts prose inside its media frame - and the interactive surface keeps
        the app's own light palette via .mk-app-surface, because unlike the
        reference our product is light.
      */}
      <section className="pb-[var(--mk-section-y)]">
        <div className="mk-container">
          <p className="mk-label">{SIGNATURE_DEMO.business}</p>
          <h2 className="mk-h2 mt-4 max-w-[22ch]">{SIGNATURE_DEMO.headline}</h2>
          <p className="mk-lede mt-5 max-w-xl">{SIGNATURE_DEMO.supporting}</p>
        </div>
        <div className="mk-page mt-12">
          <MediaFrame>
            <div className="mk-app-surface p-5 sm:p-8">
              <CrossChannelDecisionDemo compact />
            </div>
          </MediaFrame>
        </div>
      </section>

      <section className="mk-section">
        <div className="mk-container">
          <div className="mk-section-head">
            <p className="mk-label">On the phone</p>
            <h2 className="mk-h2 mt-4 max-w-[20ch]">
              New enquiry. Request understood. Next action prepared.
            </h2>
          </div>
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,24rem)_1fr] lg:gap-20">
            <MediaFrame className="pointer-events-none mx-auto w-full max-w-[20rem] lg:mx-0 lg:max-w-none">
              <SiteVideo
                className="block aspect-[9/16] w-full object-cover"
                src="/product/send-phone.mp4?v=16"
                poster="/product/poster-phone.jpg"
                label="Enquiry on a phone. A new enquiry is already understood, and the reply is ready to send."
              />
            </MediaFrame>
            <ul className="mk-rows">
              {[
                "It reads what the customer actually wrote.",
                "It checks the things this business always checks.",
                "You read it, and you send it.",
              ].map((line) => (
                <li key={line} className="mk-small py-4">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mk-section">
        <div className="mk-container">
          <div className="mk-section-head">
            <p className="mk-label">Try it</p>
            <h2 className="mk-h2 mt-4 max-w-[20ch]">
              The enquiry you just watched. Now you drive it.
            </h2>
            <p className="mk-lede mt-5 max-w-xl">
              That was a recording. This is the interactive product demo - open the thread, read the
              case file, and work the prepared reply yourself.
            </p>
          </div>
          {mounted ? (
            <LivePhone caption="Interactive demo. Work the reply and review the next action." />
          ) : (
            <Link
              to="/demo"
              className="mk-card flex min-h-16 items-center justify-between gap-4 px-4 py-4"
            >
              <div className="min-w-0">
                <p className="text-2xl font-[590] tabular-nums tracking-tight">$625</p>
                <p className="mk-mini mt-1 truncate">Priya Shah · Group mobile makeup</p>
              </div>
              <span className="mk-mini shrink-0 text-[var(--mk-fg)]">Open demo</span>
            </Link>
          )}
        </div>
      </section>

      <section className="mk-section">
        <div className="mk-container">
          <div className="mk-section-head">
            <p className="mk-label">The problem</p>
            <h2 className="mk-h2 mt-4 max-w-[20ch]">
              Messy inbound. Then you reconstruct the job from memory.
            </h2>
          </div>
          <ol className="mk-rows max-w-2xl">
            {[
              "A customer writes in - form, text, Instagram, or mail.",
              "You reconstruct what they want, what matters for this job, and whether you can do it.",
              "You reply. Then you remember to follow up.",
            ].map((line, i) => (
              <li key={line} className="flex gap-5 py-4">
                <span className="mk-label w-6 shrink-0 tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="mk-small">{line}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mk-section">
        <div className="mk-container">
          <div className="mk-section-head">
            <p className="mk-label">Who it’s for</p>
            <h2 className="mk-h2 mt-4 max-w-[20ch]">If customers ask before they book.</h2>
            <p className="mk-lede mt-5 max-w-xl">
              Makeup, photography, painting, consulting - the trade changes. The problem does not: a
              messy request, a decision that depends on how you work, and a next step that should
              not wait.
            </p>
          </div>
          <ul className="mk-rows max-w-md">
            {["Makeup", "Photography", "Painting", "Consulting"].map((t) => (
              <li key={t} className="mk-small py-4">
                {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mk-section">
        <div className="mk-container">
          <div className="mk-section-head">
            <p className="mk-label">What Enquiry does instead</p>
            <h2 className="mk-h2 mt-4 max-w-[22ch]">
              It learns the business. Then every enquiry arrives understood.
            </h2>
          </div>
          <ul className="grid gap-6 sm:grid-cols-2">
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
            ].map((f) => (
              <li key={f.title} className="mk-card p-6">
                <h3 className="mk-h3">{f.title}</h3>
                <p className="mk-small mt-3">{f.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {desk ? (
        <section className="mk-section">
          <div className="mk-container">
            <div className="mk-section-head">
              <p className="mk-label">At the desk</p>
              <p className="mk-lede mt-4 max-w-xl">
                Same sample job. Full case file. The website is here if you sit down.
              </p>
            </div>
          </div>
          {/*
            Wider than the text column on purpose, which is also what the
            reference does with its product capture: a 1320px plate against a
            1280px column at 1440. This capture is the full operator desk and
            needs the width to stay readable.
          */}
          <div className="mk-page">
            <MediaFrame url="enquiry.app/enquiries">
              <SiteVideo
                className="block aspect-video w-full object-cover"
                src="/product/send.mp4?v=18"
                poster="/product/poster-desk.jpg"
                label="The same sample case on a laptop - full case file and drafted reply ready for review."
              />
            </MediaFrame>
          </div>
        </section>
      ) : null}

      <section className="mk-section">
        <div className="mk-container">
          <div className="mk-section-head">
            <p className="mk-label">What it does not require</p>
          </div>
          <ul className="mk-rows max-w-md">
            {[
              "A CRM migration",
              "A workflow you have to build",
              "Manual pipeline hygiene",
              "A mailbox, if work arrives as a form or a DM",
            ].map((line) => (
              <li key={line} className="mk-small py-4">
                {line}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mk-section">
        <div className="mk-container">
          <div className="mk-section-head">
            <p className="mk-label">Early access</p>
            <h2 className="mk-h2 mt-4">We’re starting small.</h2>
            <p className="mk-lede mt-5 max-w-xl">
              Access opens gradually so we can work closely with the first businesses and make
              Enquiry trustworthy before opening it more widely.
            </p>
            <p className="mk-small mt-4 max-w-xl text-[var(--mk-fg)]">
              Join before public release and get 30% off your first 12 months if you become a paying
              customer.
            </p>
          </div>
          <ol className="mk-rows max-w-2xl">
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
                t: "You decide whether to continue",
                b: "Review the next action yourself. We’ll share full pricing before any paid access begins, and founding users keep the 30% first-year discount.",
              },
            ].map((s, i) => (
              <li key={s.t} className="flex gap-5 py-5">
                <span className="mk-label w-6 shrink-0 tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="mk-small text-[var(--mk-fg)]">{s.t}</p>
                  <p className="mk-small mt-1">{s.b}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/*
        The changelog-entry pattern from linear.app/changelog: a status label
        in the left grid column against a 1px rule capped by the marker dot,
        and the entry itself in the right column. This is the same vocabulary
        the full roadmap route uses.
      */}
      <section className="mk-section">
        <div className="mk-container">
          <div className="mk-section-head flex items-end justify-between gap-6">
            <div>
              <p className="mk-label">Roadmap</p>
              <h2 className="mk-h2 mt-4">What’s in motion</h2>
            </div>
            <Link to="/roadmap" className="mk-btn mk-btn-secondary mk-btn-sm shrink-0">
              Full roadmap
            </Link>
          </div>
          <div className="mk-divider mb-12" />
          {preview.map((item, i) => (
            <div key={item.id} className="mk-entry">
              <span className="mk-entry-rule" aria-hidden />
              {i === 0 ? <span className="mk-entry-marker" aria-hidden /> : null}
              <div className="mk-entry-aside">
                <p className="mk-entry-date">{item.statusLabel}</p>
              </div>
              <div className="mk-entry-body">
                <h3 className="mk-entry-title">{item.title}</h3>
                <p className="mk-prose mt-5">{item.lede}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mk-prefooter">
        <div className="mk-container">
          <h2 className="mk-h2 max-w-[20ch]">The enquiries aren’t going to decide themselves.</h2>
          <p className="mk-lede mt-5 max-w-xl">
            Join early access. See the demo to open the product case file. We’re building for
            service businesses - makeup, photography, painting, consulting - because someone
            interested still has to become booked, or lost, without you reconstructing every job by
            hand.
          </p>
          <div className="mt-10 max-w-xl">
            <WaitlistForm compact ctaLabel="Request early access" />
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
