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
    <div className="mx-auto h-full max-w-3xl overflow-y-auto px-4 py-5 pb-8 sm:py-8">
      <PageHeader
        title="Account"
        description="Workspace and account context. Billing and entitlement details appear only when real data exists."
      />
      <section className="mt-8 rounded-2xl bg-raised p-5 shadow-border sm:p-6">
        <p className="text-sm text-stone">Workspace mode</p>
        <h2 className="mt-2 text-2xl font-semibold">{demoMode ? "Sample workspace" : "Live workspace"}</h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-2">
          {businesses.length} {businesses.length === 1 ? "business" : "businesses"} available in
          this workspace. Account billing, team membership and security controls are not expanded
          here unless the product data supports them.
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
  );
}
