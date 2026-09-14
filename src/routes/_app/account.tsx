import { Link, createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { usePrototype } from "@/store/prototype-store";

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
        <section className="account-section">
          <p className="text-sm text-stone">Workspace mode</p>
          <h2 className="mt-2">{demoMode ? "Sample workspace" : "Your workspace"}</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-2">
            {businesses.length} {businesses.length === 1 ? "business" : "businesses"} available in
            this workspace.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link to="/settings">Settings</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/usage">Plan & usage</Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
