import { createFileRoute, Link } from "@tanstack/react-router";
import { socialHead } from "@/lib/site/head";
import { SiteShell } from "@/components/site/site-shell";
import { RoadmapBoard } from "@/components/site/roadmap-board";
import { ROADMAP_LEGEND } from "@/lib/launch/roadmap";
import { trackLaunchEvent } from "@/lib/launch/api";
import { currentTouch, launchSessionId } from "@/lib/launch/session";

export const Route = createFileRoute("/roadmap")({
  component: RoadmapPage,
  head: () =>
    socialHead({
      path: "/roadmap",
      title: "Roadmap · Enquiry",
      description:
        "See what we’re building now, what comes next, and the long-term direction for Enquiry - the decision layer for service-business enquiries.",
    }),
});

/*
  The page header, measured from https://linear.app/changelog on 2026-09-09.

  The reference puts its h1 at y=150 under a 73px header - 77px of padding - at
  48px/510/-1.056px/lh 48px, and holds that 48px at 390 too (only the optical
  margin steps from -2px to -1px). The shared .mk-h1 is the reference HOME h1
  tier (64px, 38px at 390), so the page tier is set inline here from the
  re-extraction. A shared .mk-h1-page would be the right home for it; that is
  filed as a request rather than edited into styles.css this pass.
*/
const PAGE_H1 = {
  fontSize: "48px",
  lineHeight: "48px",
  letterSpacing: "-1.056px",
  fontWeight: 510,
} as const;

const LEDE = { maxWidth: "36rem" } as const;

function RoadmapPage() {
  return (
    <SiteShell>
      <section className="mk-container pt-[77px]">
        <p className="mk-label">Roadmap · Built in public</p>
        <h1 className="mk-h1 mt-5 max-w-[22ch]" style={PAGE_H1}>
          We’re building Enquiry in the open.
        </h1>
        {/*
          .mk-lede sets `max-width: none` in the unlayered marketing layer, so a
          Tailwind max-w-* on the same element loses to it. The cap goes inline.
          20px between the two paragraphs is the reference's paragraph rhythm.
        */}
        <p className="mk-lede mt-6" style={LEDE}>
          Some of this works today. Some of it is being built. Some of it still needs to earn its
          place.
        </p>
        <p className="mk-lede mt-5" style={LEDE}>
          Rather than pretend otherwise, this is where Enquiry is going - and what has to be true
          for us to get there.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            to="/early-access"
            className="mk-btn mk-btn-primary"
            onClick={() => {
              const touch = currentTouch();
              void trackLaunchEvent({
                data: {
                  sessionId: launchSessionId(),
                  event_name: "roadmap_waitlist_click",
                  landing_path: "/roadmap",
                  utm_source: touch.utm_source,
                  utm_medium: touch.utm_medium,
                  utm_campaign: touch.utm_campaign,
                  utm_content: touch.utm_content,
                  referrer: touch.referrer,
                  feature_id: "hero",
                },
              }).catch(() => undefined);
            }}
          >
            Join early access
          </Link>
          <a href="#stage-understand" className="mk-btn mk-btn-secondary">
            See where we are now
          </a>
        </div>

        {/*
          The statuses the rail labels use, so the vocabulary is defined before
          the stream that speaks it. The mark is the reference's 12px monospace
          label tier; the label is its 14px rail tier; the hint its 13px tier.
        */}
        <div className="mt-10">
          <p className="mk-label">Statuses</p>
          <ul className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
            {ROADMAP_LEGEND.map((status) => (
              <li key={status.id} className="max-w-[16rem]">
                <p className="mk-small" style={{ color: "var(--mk-fg)" }}>
                  <span aria-hidden className="mr-2 font-mono text-xs">
                    {status.mark}
                  </span>
                  {status.label}
                </p>
                <p className="mk-mini mt-1">{status.hint}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="mt-10">
        <RoadmapBoard />
      </div>
    </SiteShell>
  );
}
