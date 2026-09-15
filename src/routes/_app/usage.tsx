import { Link, createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { CreditCard, ArrowRight, CircleHelp } from "lucide-react";
import { WorkspaceDestination } from "@/components/ui/workspace-destination";

export const Route = createFileRoute("/_app/usage")({
  component: UsagePage,
});

function UsagePage() {
  return (
    <div className="ui-page-scroll">
      <div className="ui-page account-page">
        <PageHeader title="Plan & usage" />
        <section className="account-availability">
          <span className="account-feature-icon">
            <CreditCard size={30} strokeWidth={1.5} aria-hidden="true" />
          </span>
          <h2>Plan information unavailable</h2>
          <p className="mt-2 text-sm text-stone">
            No plan or usage allowance has been set for this workspace.
          </p>
          <Button asChild variant="secondary" className="mt-5">
            <Link to="/account">
              Your account <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </Button>
        </section>
        <div className="workspace-destinations">
          <WorkspaceDestination
            to="/support"
            icon={CircleHelp}
            title="Help & support"
            description="Answers about your workspace"
          />
        </div>
      </div>
    </div>
  );
}
