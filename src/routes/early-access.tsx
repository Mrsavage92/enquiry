import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/site/site-shell";
import { WaitlistForm } from "@/components/site/waitlist-form";

export const Route = createFileRoute("/early-access")({
  component: EarlyAccess,
  head: () => ({
    meta: [
      { title: "Early access · Enquiry" },
      {
        name: "description",
        content:
          "Join Enquiry early access. We’re opening gradually so we can work closely with the first service businesses.",
      },
    ],
  }),
});

const PROMISES = [
  {
    t: "Early access as the product is ready",
    b: "We invite businesses in small groups as the product is ready for them.",
  },
  {
    t: "A direct line into what we learn",
    b: "Early businesses can tell us where Enquiry helps, where it gets in the way, and what still needs work.",
  },
  {
    t: "Clear communication before anything becomes paid",
    b: "Enquiry is intended to be a paid product. Pricing will be shared before any paid access begins.",
  },
];

function EarlyAccess() {
  return (
    <SiteShell>
      <article className="mx-auto max-w-xl px-5 py-10 sm:py-20">
        <p className="eyebrow">Early access</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          Be one of the first businesses to use Enquiry.
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-2">
          We’re opening Enquiry gradually so we can work closely with the first service businesses
          and improve the product before wider release.
        </p>
        <div className="mt-10">
          <WaitlistForm />
        </div>

        <h2 className="mt-14 text-lg font-semibold tracking-tight">What joining means</h2>
        <ul className="mt-4 text-sm leading-relaxed text-ink-2">
          {PROMISES.map((item) => (
            <li key={item.t} className="border-t border-line py-4 last:border-b">
              <p className="font-medium text-ink">{item.t}</p>
              <p className="mt-1">{item.b}</p>
            </li>
          ))}
        </ul>

        <aside className="mt-10 rounded-lg border border-line bg-raised px-5 py-5">
          <p className="text-xs uppercase tracking-wider text-stone">Why not open it to everyone?</p>
          <p className="mt-3 text-sm leading-relaxed text-ink-2">
            Enquiry is making business decisions, not just drafting text. We’d rather expand
            carefully and make those decisions trustworthy than chase a big signup number.
          </p>
        </aside>
      </article>
    </SiteShell>
  );
}
