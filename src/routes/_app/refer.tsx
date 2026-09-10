import { Link, createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

export const Route = createFileRoute("/_app/refer")({
  component: ReferPage,
});

function ReferPage() {
  return (
    <div className="ui-page-scroll">
      <div className="ui-page account-page">
        <PageHeader title="Refer a friend" />
        <section className="account-section">
          <h2>Referrals are not available yet</h2>
          <p className="mt-2 text-sm text-stone">
            There is no active referral programme or reward at the moment.
          </p>
          <Button asChild variant="secondary" className="mt-5">
            <Link to="/today">Back to Today</Link>
          </Button>
        </section>
      </div>
    </div>
  );
}
