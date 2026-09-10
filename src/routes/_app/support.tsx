import { Link, createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

export const Route = createFileRoute("/_app/support")({
  component: SupportPage,
});

function SupportPage() {
  return (
    <div className="ui-page-scroll">
      <div className="ui-page account-page">
        <PageHeader title="Help & support" />
        <section className="account-section">
          <h2>Your workspace</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild variant="secondary">
              <Link to="/trust/access">Connections</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/business">Business details</Link>
            </Button>
          </div>
        </section>
        <section className="account-section">
          <h2>Contact support</h2>
          <p className="mt-2 text-sm text-stone">
            A support contact is not available in this workspace yet.
          </p>
          <Button asChild variant="secondary" className="mt-5">
            <Link to="/settings">Open settings</Link>
          </Button>
        </section>
      </div>
    </div>
  );
}
