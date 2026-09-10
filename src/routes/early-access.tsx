import { createFileRoute } from "@tanstack/react-router";
import { socialHead } from "@/lib/site/head";
import { SiteShell } from "@/components/site/site-shell";
import { WaitlistForm } from "@/components/site/waitlist-form";

export const Route = createFileRoute("/early-access")({
  component: EarlyAccess,
  head: () =>
    socialHead({
      path: "/early-access",
      title: "Early access · Enquiry",
      description:
        "Join Enquiry early access. We’re opening gradually with a founding-user offer for the first service businesses.",
    }),
});

const PROMISES = [
  {
    t: "Early access as the product is ready",
    b: "We invite businesses in small groups as the product is ready for them.",
  },
  {
    t: "30% off your first 12 months",
    b: "Join before public release and, if you become a paying customer, your first 12 months are 30% off the standard price.",
  },
  {
    t: "A direct line into what we learn",
    b: "Early businesses can tell us where Enquiry helps, where it gets in the way, and what still needs work.",
  },
  {
    t: "No surprise charge",
    b: "Enquiry is intended to be a paid product. We’ll share the full pricing before any paid access begins, and you decide whether to continue.",
  },
];

function EarlyAccess() {
  return (
    <SiteShell>
      {/*
        The system's page-header pattern (.style-mirror/system.md §5): this
        headline is a sentence, not a short page name, so it takes the home
        hero tier (.mk-h1, 64px down to 38px) rather than the changelog
        page-title tier /updates uses - the same split the system's own
        composing guide draws between a hero and a listing page.
      */}
      <section className="mk-page-header mk-container pt-[96px] sm:pt-[120px]">
        <p className="mk-label">Early access</p>
        <h1 className="mk-h1 mt-5 max-w-[18ch]">Be one of the first businesses to use Enquiry.</h1>
        <p className="mk-lede mt-6 max-w-xl">
          We’re opening Enquiry gradually so we can work closely with the first service businesses
          and improve the product before wider release.
        </p>
        {/*
          DERIVATION: .mk-small is unlayered (system.md §1), so a Tailwind
          colour utility on the same element always loses to its own
          color: var(--mk-fg-2) - the same trap home's identical sentence
          (text-[var(--mk-fg)] on .mk-small) falls into, confirmed by the
          computed-style check: both resolve to fg-2, not fg. An inline style
          wins over both the utilities layer and unlayered stylesheet rules,
          so it is the only way to step this line up to the fg tier without
          touching the shared .mk-small rule.
        */}
        <p className="mk-small mt-4 max-w-xl" style={{ color: "var(--mk-fg)" }}>
          Join before public release and get 30% off your first 12 months if you become a paying
          customer.
        </p>

        {/* The waitlist form is the primary block on this route - directly under the offer, no card wrap (it is not a signed-in app component, so it inherits the mirror palette on its own tokens, same as home's hero form). */}
        <div className="mt-10 max-w-xl">
          <WaitlistForm />
        </div>
      </section>

      <section className="mk-section">
        <div className="mk-container">
          <div className="mk-section-head">
            <h2 className="mk-h2 max-w-[20ch]">What joining means</h2>
          </div>
          <ul className="mk-rows max-w-2xl">
            {PROMISES.map((item) => (
              <li key={item.t} className="py-5">
                <p className="mk-small" style={{ color: "var(--mk-fg)" }}>
                  {item.t}
                </p>
                <p className="mk-small mt-1">{item.b}</p>
              </li>
            ))}
          </ul>

          <div className="mk-card mt-12 max-w-xl p-6">
            <p className="mk-label">Why not open it to everyone?</p>
            <p className="mk-small mt-3">
              Enquiry is making business decisions, not just drafting text. We’d rather expand
              carefully and make those decisions trustworthy than chase a big signup number.
            </p>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
