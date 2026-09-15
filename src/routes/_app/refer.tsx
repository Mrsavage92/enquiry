import { Link, createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Gift, ArrowRight, Route as RouteIcon } from "lucide-react";
import { WorkspaceDestination } from "@/components/ui/workspace-destination";

export const Route = createFileRoute("/_app/refer")({
  component: ReferPage,
});

function ReferPage() {
  return (
    <div className="ui-page-scroll">
      <div className="ui-page account-page">
        <PageHeader title="Refer a friend" />
        <section className="account-availability">
          <span className="account-feature-icon account-feature-icon-rose">
            <Gift size={30} strokeWidth={1.5} aria-hidden="true" />
          </span>
          <h2>Referrals are not available yet</h2>
          <p className="mt-2 text-sm text-stone">
            There is no active referral programme or reward at the moment.
          </p>
          <Button asChild variant="secondary" className="mt-5">
            <Link to="/today">
              Back to Today <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </Button>
        </section>
        <div className="workspace-destinations">
          <WorkspaceDestination
            to="/roadmap"
            icon={RouteIcon}
            title="What's next for Enquiry"
            description="The roadmap, with current and planned outcomes"
          />
        </div>
      </div>
    </div>
  );
}
