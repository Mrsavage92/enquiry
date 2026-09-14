import { Link, createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

export const Route = createFileRoute("/_app/usage")({
  component: UsagePage,
});

function UsagePage() {
  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto px-4 py-5 pb-8 sm:py-8">
      <PageHeader
        title="Plan & usage"
        description="Plan limits are not configured in this build. This screen is reserved for the real entitlement model."
      />
      <section className="mt-8 rounded-2xl bg-raised p-5 shadow-border sm:p-6">
        <p className="text-sm text-stone">Current plan</p>
        <h2 className="mt-2 text-2xl font-semibold">Not configured yet</h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-2">
          Enquiry will show real quota, billing and entitlement information here once that data
          exists. No demo limit or pricing is being treated as production truth.
        </p>
        <Button asChild variant="secondary" className="mt-5">
          <Link to="/settings">Open settings</Link>
        </Button>
      </section>
    </div>
  );
}
