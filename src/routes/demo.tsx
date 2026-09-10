import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/site/site-shell";
import { CrossChannelDecisionDemo } from "@/components/site/cross-channel-decision-demo";
import { MediaFrame } from "@/components/site/device-frame";
import { SIGNATURE_DEMO } from "@/lib/site/signature-demo";

export const Route = createFileRoute("/demo")({
  component: Demo,
  head: () => ({
    meta: [
      { title: "One enquiry · Enquiry" },
      {
        name: "description",
        content:
          "A form becomes a text. The scope changes. Enquiry keeps the request, the business checks and the next action current.",
      },
    ],
  }),
});

function Demo() {
  return (
    <SiteShell>
      {/*
        Someone can land here from a shared link with no other context. The
        case study names a business, a customer and a phone number, so the
        page has to say what it is before it shows any of that - relying on
        /terms to disclose it is relying on a page nobody opens first.

        The interactive demo's own header (cross-channel-decision-demo.tsx)
        is suppressed with `compact` and rebuilt here in mk-container so it
        aligns to the same content edge as the nav and every other marketing
        route, and its plate stays free of prose - the reference never puts
        copy inside its media frame. Same shape as index.tsx's "Try it"
        section, which wraps the identical component the same way.
      */}
      <section className="mk-section">
        <div className="mk-container">
          <div className="mk-section-head">
            <p className="mk-label">Demo · sample enquiry, not a real customer</p>
            <p className="mk-label mt-2">{SIGNATURE_DEMO.business}</p>
            <h1 className="mk-h2 mt-4 max-w-[22ch]">{SIGNATURE_DEMO.headline}</h1>
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
      </section>

      <section className="mk-prefooter">
        <div className="mk-container">
          <p className="mk-prose max-w-xl">{SIGNATURE_DEMO.takeaway}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/early-access" className="mk-btn mk-btn-primary">
              Join early access
            </Link>
            <Link to="/login" className="mk-btn mk-btn-secondary">
              Already invited? Sign in
            </Link>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
