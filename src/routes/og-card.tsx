import { createFileRoute } from "@tanstack/react-router";
import { Wordmark } from "@/components/ui/wordmark";
import { SIGNATURE_DEMO } from "@/lib/site/signature-demo";

/**
 * Unlinked, noindex render target for the social share card (public/og.jpg).
 * Not part of the app's navigation or sitemap - visited directly at a fixed
 * 1200x630 viewport, screenshotted, then discarded. Renders the real
 * "interior painting" case from src/lib/site/signature-demo.ts (the same
 * data source as the homepage's CrossChannelDecisionDemo) so the card shows
 * an actual product state rather than a mock.
 */
export const Route = createFileRoute("/og-card")({
  component: OgCard,
  head: () => ({
    meta: [{ title: "OG card render" }, { name: "robots", content: "noindex, nofollow" }],
  }),
});

function OgCard() {
  const state = SIGNATURE_DEMO.form;
  const scope = state.facts.find((f) => f.id === "scope")!;
  const deadline = state.facts.find((f) => f.id === "deadline")!;
  const eligibility = state.checks.find((c) => c.id === "eligibility")!;
  const capacity = state.checks.find((c) => c.id === "capacity")!;

  return (
    <div
      className="bg-paper text-ink"
      style={{ width: 1200, height: 630, display: "flex", overflow: "hidden" }}
    >
      <div
        style={{
          width: 452,
          padding: "56px 0 56px 56px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <Wordmark />
        <div>
          <p className="eyebrow" style={{ fontSize: 15 }}>
            The app
          </p>
          <span className="page-rule" style={{ marginTop: 14, width: 32, height: 3 }} aria-hidden />
          <h1
            className="font-serif font-semibold"
            style={{
              marginTop: 22,
              fontSize: 58,
              lineHeight: 1.08,
              letterSpacing: "-0.03em",
              maxWidth: 380,
            }}
          >
            Stop managing enquiries.
          </h1>
        </div>
        <p className="text-stone" style={{ fontSize: 20, lineHeight: 1.45, maxWidth: 350 }}>
          The app for service businesses.
        </p>
      </div>

      <div
        style={{
          width: 692,
          padding: "56px 56px 56px 0",
          display: "flex",
          alignItems: "center",
        }}
      >
        <article className="proof-doc" style={{ width: "100%", padding: 44, borderRadius: 18 }}>
          <p className="eyebrow" style={{ fontSize: 15 }}>
            Already decided
          </p>
          <p
            className="mt-4 font-serif font-semibold"
            style={{ fontSize: 33, lineHeight: 1.24, letterSpacing: "-0.02em" }}
          >
            {state.want}
          </p>

          <div
            className="border-line"
            style={{ marginTop: 26, paddingTop: 22, borderTop: "1px solid var(--color-line)" }}
          >
            <p
              className="text-stone"
              style={{
                fontSize: 15,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              Next
            </p>
            <p
              className="font-serif font-semibold"
              style={{ marginTop: 6, fontSize: 42, lineHeight: 1.15, letterSpacing: "-0.03em" }}
            >
              {state.nextAction}
            </p>
          </div>

          <dl style={{ marginTop: 26, borderTop: "1px solid var(--color-line)" }}>
            {[scope, deadline].map((f) => (
              <div
                key={f.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  padding: "13px 0",
                  borderBottom: "1px solid var(--color-line)",
                }}
              >
                <dt className="text-stone" style={{ fontSize: 22 }}>
                  {f.label}
                </dt>
                <dd style={{ fontSize: 22, fontWeight: 500 }}>{f.value}</dd>
              </div>
            ))}
          </dl>

          <div style={{ marginTop: 22, display: "flex", gap: 12 }}>
            <Pill label={eligibility.label} value={eligibility.value} />
            <Pill label={capacity.label} value="Provisional" />
          </div>
        </article>
      </div>
    </div>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <span
      className="bg-ok-bg text-ok"
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 6,
        borderRadius: 8,
        padding: "8px 14px",
        fontSize: 17,
        fontWeight: 600,
      }}
    >
      <span style={{ fontWeight: 500 }}>{label}</span>
      <span style={{ fontWeight: 700 }}>{value}</span>
    </span>
  );
}
