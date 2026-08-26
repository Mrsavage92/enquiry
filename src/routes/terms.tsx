import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/site/site-shell";

export const Route = createFileRoute("/terms")({
  component: Terms,
  head: () => ({
    meta: [
      { title: "Terms · Enquiry" },
      {
        name: "description",
        content: "Terms for the Enquiry website, waitlist, and in-browser prototype.",
      },
    ],
  }),
});

function Terms() {
  return (
    <SiteShell>
      <article className="mx-auto max-w-xl px-5 py-16 sm:py-20">
        <p className="eyebrow">Legal</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Terms</h1>
        <p className="mt-4 text-sm text-stone">Last updated 25 August 2026</p>
        <div className="mt-10 space-y-6 text-sm leading-relaxed text-ink-2">
          <p>
            These terms cover this website, the early-access list, and the in-browser Enquiry
            prototype. They are not a customer contract for a finished product.
          </p>
          <h2 className="text-lg font-semibold tracking-tight text-ink">The waitlist</h2>
          <p>
            Joining early access is a request, not a purchase and not a guarantee of a place.
            We invite businesses in small groups as the product is ready. Enquiry is intended to
            become a paid product; pricing is not promised in advance.
          </p>
          <h2 className="text-lg font-semibold tracking-tight text-ink">The prototype</h2>
          <p>
            “Open the app” is a working demonstration with sample jobs. It does not send real
            email, texts, or Instagram messages. Do not use it as the system of record for a live
            customer. Anything you type there can be reset.
          </p>
          <h2 className="text-lg font-semibold tracking-tight text-ink">The product will change</h2>
          <p>
            Features, access, and this site will move. The public roadmap is direction, not a
            delivery contract. We may pause or close early access.
          </p>
          <h2 className="text-lg font-semibold tracking-tight text-ink">Acceptable use</h2>
          <p>
            Don’t abuse the waitlist, scrape the site, or treat sample customers as real people
            to contact. The names in the prototype are fixtures.
          </p>
          <h2 className="text-lg font-semibold tracking-tight text-ink">Liability</h2>
          <p>
            The site and prototype are provided as-is while we build. To the extent Australian
            law allows, we are not liable for decisions you make from the demonstration. Nothing
            here limits rights you cannot waive.
          </p>
          <p>
            <Link to="/privacy" className="font-medium text-ink underline-offset-4 hover:underline">
              Privacy
            </Link>{" "}
            explains the waitlist. Questions belong on a reply to any Enquiry email we send you.
          </p>
        </div>
      </article>
    </SiteShell>
  );
}
