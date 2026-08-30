import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/site/site-shell";
import { RoadmapBoard } from "@/components/site/roadmap-board";
import { Button } from "@/components/ui/button";
import { ROADMAP_ACCESS, ROADMAP_PHASE, ROADMAP_WRITTEN } from "@/lib/launch/roadmap";
import { trackLaunchEvent } from "@/lib/launch/api";
import { currentTouch, launchSessionId } from "@/lib/launch/session";
import { HeroIn } from "@/components/site/motion";

export const Route = createFileRoute("/roadmap")({
  component: RoadmapPage,
  head: () => ({
    meta: [
      { title: "Roadmap · Enquiry" },
      {
        name: "description",
        content:
          "See what we’re building now, what comes next, and the long-term direction for Enquiry — the intelligence layer for service-business enquiries.",
      },
    ],
  }),
});

function RoadmapPage() {
  return (
    <SiteShell notebook>
      <article className="mx-auto max-w-3xl px-5 pb-12 pt-10 sm:pb-16 sm:pt-20">
        <HeroIn>
          <p className="eyebrow">Roadmap · Built in public</p>
        </HeroIn>
        <HeroIn delay={80}>
          <h1 className="text-halo mt-4 max-w-xl font-serif text-[2.75rem] font-semibold leading-[1.08] tracking-tight sm:max-w-2xl sm:text-5xl md:text-6xl">
            We’re building Enquiry
            <span className="block">in the open.</span>
          </h1>
        </HeroIn>
        <HeroIn delay={160}>
          <p className="text-halo mt-6 max-w-lg text-lg leading-relaxed text-ink-2 sm:text-xl">
            Some of this works today. Some of it is being built. Some of it still needs to earn its place.
          </p>
        </HeroIn>
        <HeroIn delay={220}>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-ink-2">
            Rather than pretend otherwise, this is where Enquiry is going — and what has to be true for us to get there.
          </p>
        </HeroIn>
        <HeroIn delay={280}>
          <p className="mt-6 text-xs uppercase tracking-wider text-stone">
            Last updated {ROADMAP_WRITTEN}
            <span className="mx-2 text-line-strong">·</span>
            {ROADMAP_PHASE}
            <span className="mx-2 text-line-strong">·</span>
            {ROADMAP_ACCESS}
          </p>
        </HeroIn>
        <HeroIn delay={340}>
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
        </HeroIn>
      </article>
      <RoadmapBoard />
    </SiteShell>
  );
}
