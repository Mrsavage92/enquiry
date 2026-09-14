import { Link, createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

export const Route = createFileRoute("/_app/usage")({
  component: UsagePage,
});

function UsagePage() {
  return (
    <div className="ui-page-scroll">
      <div className="ui-page account-page">
        <PageHeader title="Plan & usage" />
        <section className="account-section">
          <h2>Plan information unavailable</h2>
          <p className="mt-2 text-sm text-stone">
            No plan or usage allowance has been set for this workspace.
          </p>
          <Button asChild variant="secondary" className="mt-5">
            <Link to="/settings">Open settings</Link>
          </Button>
        </section>
      </div>
    </div>
  );
}
