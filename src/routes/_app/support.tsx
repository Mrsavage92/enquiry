import { Link, createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

export const Route = createFileRoute("/_app/support")({
  component: SupportPage,
});

function SupportPage() {
  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto px-4 py-5 pb-8 sm:py-8">
      <PageHeader
        title="Help & support"
        description="Support resources can live here when the real contact route is ready."
      />
      <section className="mt-8 rounded-2xl bg-raised p-5 shadow-border sm:p-6">
        <h2 className="text-2xl font-semibold">No support channel is configured yet</h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-2">
          For now, use Settings to check workspace details and connections. This page avoids
          publishing a fake email address, chat widget, or service promise.
        </p>
        <Button asChild variant="secondary" className="mt-5">
          <Link to="/settings">Open settings</Link>
        </Button>
      </section>
    </div>
  );
}
