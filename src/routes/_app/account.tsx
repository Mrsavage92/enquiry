import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui/page-header";
import { usePrototype } from "@/store/prototype-store";
import { Building2, CreditCard, Settings2, CircleHelp } from "lucide-react";
import { WorkspaceDestination } from "@/components/ui/workspace-destination";

export const Route = createFileRoute("/_app/account")({
  component: AccountPage,
});

function AccountPage() {
  const businesses = usePrototype((s) => s.businesses);
  const demoMode = usePrototype((s) => s.demoMode);
  return (
    <div className="ui-page-scroll">
      <div className="ui-page account-page">
        <PageHeader title="Account" />
        <section className="account-identity">
          <span className="account-feature-icon">
            <Building2 size={28} strokeWidth={1.5} aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm text-stone">Workspace</p>
            <h2 className="mt-2">{demoMode ? "Sample workspace" : "Your workspace"}</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-2">
              {businesses.length} {businesses.length === 1 ? "business" : "businesses"} available in
              this workspace.
            </p>
          </div>
        </section>
        <div className="workspace-destinations">
          <WorkspaceDestination
            to="/settings"
            icon={Settings2}
            title="Settings"
            description="Working hours, notices and this device"
          />
          <WorkspaceDestination
            to="/usage"
            icon={CreditCard}
            title="Plan & usage"
            description="Workspace plan information"
          />
          <WorkspaceDestination
            to="/support"
            icon={CircleHelp}
            title="Help & support"
            description="Answers and workspace support"
          />
        </div>
      </div>
    </div>
  );
}
