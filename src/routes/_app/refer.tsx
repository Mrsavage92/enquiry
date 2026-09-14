import { Link, createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

export const Route = createFileRoute("/_app/refer")({
  component: ReferPage,
});

function ReferPage() {
  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto px-4 py-5 pb-8 sm:py-8">
      <PageHeader
        title="Refer a friend"
        description="A place for referrals once the real reward and sharing rules are defined."
      />
      <section className="mt-8 rounded-2xl bg-raised p-5 shadow-border sm:p-6">
        <h2 className="text-2xl font-semibold">Referral rewards are not configured yet</h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-2">
          This keeps the destination in the app without inventing a discount, credit, or programme
          that does not exist in product data.
        </p>
        <Button asChild variant="secondary" className="mt-5">
          <Link to="/today">Back to Today</Link>
        </Button>
      </section>
    </div>
  );
}
