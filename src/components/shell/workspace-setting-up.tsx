import { Link } from "@tanstack/react-router";

/**
 * What a real tenant sees before R2B hydrates their workspace from the server.
 *
 * A freshly onboarded business genuinely has no enquiries, no Business Brain and
 * no trust history, and the client store no longer holds fixture content it
 * could borrow to look populated. Showing another business's demo data here
 * would be the single most dishonest thing this product could do - the operator
 * cannot tell sample work from their own, and every number on screen would be
 * someone else's.
 *
 * So this says nothing is here yet, because nothing is. Server-authoritative
 * hydration is R2B.
 */
export function WorkspaceSettingUp({
  title = "Your workspace is ready",
  body = "Nothing has arrived yet. When an enquiry comes in, it appears here with what Enquiry worked out and what it needs from you.",
}: {
  title?: string;
  body?: string;
}) {
  return (
    <div className="mx-auto max-w-lg px-5 py-16 sm:py-24">
      <p className="eyebrow">Set up</p>
      <h1 className="site-display mt-3">{title}</h1>
      <p className="site-lede mt-4">{body}</p>
      <p className="mt-8 text-sm text-stone">
        Want to see how it works with a worked example first?{" "}
        <Link to="/demo" className="text-ink underline underline-offset-4">
          Open the demo
        </Link>
        . It stays separate from your workspace.
      </p>
    </div>
  );
}
