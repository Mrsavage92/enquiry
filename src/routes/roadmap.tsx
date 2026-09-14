import { createFileRoute, Link } from "@tanstack/react-router";
import { socialHead } from "@/lib/site/head";
import { SiteShell } from "@/components/site/site-shell";
import { RoadmapBoard } from "@/components/site/roadmap-board";
import { Button } from "@/components/ui/button";
import { ROADMAP_ACCESS, ROADMAP_PHASE, ROADMAP_WRITTEN } from "@/lib/launch/roadmap";
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

function RoadmapPage() {
  return (
    <SiteShell>
      <article className="public-container public-page-heading">
        <h1>Roadmap</h1>
        <p>
          What works, what we are building and what comes next. Direction, not a promise of delivery
          dates.
        </p>
        <p className="mt-6 text-sm text-stone">
          Last updated {ROADMAP_WRITTEN}
          <span className="mx-2 text-line-strong">·</span>
          {ROADMAP_PHASE}
          <span className="mx-2 text-line-strong">·</span>
          {ROADMAP_ACCESS}
        </p>
        <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap">
          <Button asChild className="min-h-12 shrink-0 sm:min-h-10">
            <Link
              to="/early-access"
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
          </Button>
          <Button variant="secondary" asChild className="min-h-12 shrink-0 sm:min-h-10">
            <a href="#stage-understand">See where we are now</a>
          </Button>
        </div>
      </article>
      <RoadmapBoard />
    </SiteShell>
  );
}
