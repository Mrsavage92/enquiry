import { createFileRoute, Link } from "@tanstack/react-router";
import { socialHead } from "@/lib/site/head";
import { SiteShell } from "@/components/site/site-shell";
import { MediaFrame } from "@/components/site/device-frame";
import { CrossChannelDecisionDemo } from "@/components/site/cross-channel-decision-demo";
import { WaitlistForm } from "@/components/site/waitlist-form";
import { SIGNATURE_DEMO } from "@/lib/site/signature-demo";
import { HowSteps } from "@/components/site/how-steps";
import { HowProofCase } from "@/components/site/how-proof-case";

export const Route = createFileRoute("/how")({
  component: How,
  head: () =>
    socialHead({
      path: "/how",
      title: "How it works · Enquiry",
      description:
        "Bring an enquiry into Enquiry, reconstruct the request, apply how your business works, and prepare the next action.",
    }),
});

function How() {
  return (
    <SiteShell>
      {/*
        Page header, not the home hero: the reference's own page-title tier
        (tokens.lock.json typography.scale_390.h1_page) stays 48px/510/
        -1.056px/lh 48px at BOTH 1440 and 390 - it does not step down the way
        `.mk-h1`/`.mk-h2` do, so it is built here rather than borrowing either
        class. `--mk-h1-optical` is reused rather than duplicated: it already
        switches -2px -> -1px at the same 640 breakpoint the reference's own
        page-title optical pull does.
      */}
      <section className="pb-[var(--mk-section-y)] pt-[64px] sm:pt-[96px]">
        <div className="mk-container">
          <p className="mk-label">How it works</p>
          <h1 className="ml-[var(--mk-h1-optical)] mt-5 max-w-[22ch] text-[48px] leading-[48px] font-[var(--mk-weight-medium)] tracking-[-1.056px] text-[var(--mk-fg)]">
            Work arrives. The next action is ready.
          </h1>
          <p className="mk-lede mt-6 max-w-2xl">
            Enquiry reconstructs the request, applies how this business works, and works out what
            can safely be decided now. You approve. You should mainly make judgement calls - not CRM
            data entry.
          </p>
        </div>
      </section>

      {/*
        Feature section 1: the live decision demo is this route's first piece
        of product media, in the reference's section-head + full-width
        MediaFrame shape (system.md §5, same as the interactive block on /).
        CrossChannelDecisionDemo owns `.mk-app-surface` internally when
        compact - the outer one here matches index.tsx's own usage.
      */}
      <section className="mk-section">
        <div className="mk-container">
          <div className="mk-section-head">
            <p className="mk-label">{SIGNATURE_DEMO.business}</p>
            <h2 className="mk-h2 mt-4 max-w-2xl">{SIGNATURE_DEMO.headline}</h2>
            <p className="mk-lede mt-5 max-w-xl">{SIGNATURE_DEMO.supporting}</p>
          </div>
        </div>
        <div className="mk-page">
          <MediaFrame>
            <div className="mk-app-surface p-5 sm:p-8">
              <CrossChannelDecisionDemo compact />
            </div>
          </MediaFrame>
        </div>
        <div className="mk-container mt-8">
          <p className="mk-small max-w-xl">{SIGNATURE_DEMO.takeaway}</p>
        </div>
      </section>

      {/* Feature section 2: the six steps - no per-step media, so the system's card/list pattern. */}
      <HowSteps />

      {/* Feature section 3: the pricing case, in its own component for the same reason. */}
      <HowProofCase />

      {/* Closing CTA block, the system's shape (system.md §5 / index.tsx prefooter). */}
      <section className="mk-section">
        <div className="mk-container">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link to="/early-access" className="mk-btn mk-btn-primary">
              Join early access
            </Link>
            <Link to="/demo" className="mk-btn mk-btn-secondary">
              See demo
            </Link>
          </div>
        </div>
      </section>
      <section className="mk-prefooter">
        <div className="mk-container">
          <h2 className="mk-h2 max-w-[20ch]">Join early access</h2>
          <p className="mk-lede mt-5 max-w-xl">Email first. A few optional questions after.</p>
          <div className="mt-10 max-w-xl">
            <WaitlistForm compact ctaLabel="Request early access" />
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
