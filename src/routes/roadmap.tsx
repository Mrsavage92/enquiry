import { createFileRoute } from "@tanstack/react-router";
import { socialHead } from "@/lib/site/head";
import { SiteShell } from "@/components/site/site-shell";
import { RoadmapBoard } from "@/components/site/roadmap-board";
import "@/roadmap.css";

export const Route = createFileRoute("/roadmap")({
  component: RoadmapPage,
  head: () =>
    socialHead({
      path: "/roadmap",
      title: "Roadmap · Enquiry",
      description:
        "Less to remember. More room for your business. Explore Enquiry's direction: connected conversations, planned iPhone and Android apps, and thoughtful follow-up.",
    }),
});

function RoadmapPage() {
  return (
    <SiteShell>
      <header className="public-container roadmap-page-heading">
        <h1>
          Enquiry roadmap<span aria-hidden="true">.</span>
        </h1>
        <p className="roadmap-lede">Less to remember. More room for your business.</p>
        <p className="roadmap-intro">
          Our direction, not delivery dates. Anyone can join the list at the founding price.
        </p>
      </header>
      <RoadmapBoard />
    </SiteShell>
  );
}
