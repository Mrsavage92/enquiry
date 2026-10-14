import { createFileRoute } from "@tanstack/react-router";
import { Wordmark } from "@/components/ui/wordmark";
import { OFFER } from "@/lib/site/offer";

/**
 * Unlinked, noindex render target for the social share card (public/og.jpg).
 * Not part of the app's navigation or sitemap - visited directly at a fixed
 * 1200x630 viewport, screenshotted, then discarded.
 *
 * It carries the home page's own words: the category line and promise from
 * the hero (src/components/site/brand-hero.tsx) and the founding offer from
 * src/lib/site/offer.ts, so the card cannot quote a price the site does not.
 * Everything is large enough to read at a thumbnail.
 *
 * public/og.jpg is a screenshot of this route, not a live render: whenever a
 * price or the offer wording in offer.ts changes, regenerate it (build,
 * preview, screenshot /og-card at 1200x630). scripts/og-card.test.mjs keeps
 * that reminder beside the prices and fails if this card states a price itself.
 *
 * Contrast on the #f0eef5 card ground: #292136 13.37:1, #64586d 5.78:1,
 * #fff on #654ac2 6.34:1. No image behind any text.
 */
export const Route = createFileRoute("/og-card")({
  component: OgCard,
  head: () => ({
    meta: [{ title: "OG card render" }, { name: "robots", content: "noindex, nofollow" }],
  }),
});

function OgCard() {
  return (
    <div
      style={{
        width: 1200,
        height: 630,
        overflow: "hidden",
        position: "relative",
        background: "#f0eef5",
        color: "#292136",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px",
        fontFamily: '"Inter Variable", Inter, sans-serif',
      }}
    >
      <div style={{ position: "relative" }}>
        <Wordmark />
      </div>
      <div style={{ position: "relative", maxWidth: 820 }}>
        <p style={{ fontSize: 26, lineHeight: 1.4, color: "#64586d", fontWeight: 500 }}>
          For painters, cleaners, mobile beauty and other service businesses that quote before they
          book.
        </p>
        <p
          style={{
            marginTop: 18,
            fontSize: 68,
            lineHeight: 1.08,
            fontWeight: 650,
            color: "#292136",
          }}
        >
          Know what you can safely promise before you reply.
        </p>
      </div>
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 20 }}>
        <span
          style={{
            background: "#654ac2",
            color: "#fff",
            borderRadius: 10,
            padding: "14px 22px",
            fontSize: 28,
            fontWeight: 650,
          }}
        >
          {OFFER.headline}
        </span>
        <span style={{ fontSize: 24, color: "#64586d", maxWidth: 360, lineHeight: 1.35 }}>
          {OFFER.after}
        </span>
      </div>
    </div>
  );
}
