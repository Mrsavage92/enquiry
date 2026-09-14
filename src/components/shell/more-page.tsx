import { Link, useNavigate } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Gauge,
  Gift,
  Globe,
  LineChart,
  Settings,
  UserRound,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { usePrototype } from "@/store/prototype-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BUSINESSES } from "@/fixtures";
import { visibleBusinesses } from "@/lib/workspace/resolve-business";
import { InstallAppRow } from "./install-app";
import { useEmbed } from "@/lib/embed";

export function MorePage() {
  const startSetup = usePrototype((s) => s.startSetup);
  const enterSample = usePrototype((s) => s.enterSample);
  const demoMode = usePrototype((s) => s.demoMode);
  const businesses = usePrototype((s) => s.businesses);
  const filter = usePrototype((s) => s.businessFilter);
  const setFilter = usePrototype((s) => s.setBusinessFilter);
  const navigate = useNavigate();
  const showToday = () => void navigate({ to: "/today" });
  const embed = useEmbed();
  // Live mode shows the tenant's own businesses. Filtering to the fixture
  // "glow" id meant a real workspace vanished from its own selector the
  // moment it had a real uuid.
  const visible = visibleBusinesses(businesses, { demoMode, fixtures: BUSINESSES });
  const current =
    visible.find((business) => business.id === filter) ??
    (visible.length === 1 ? visible[0] : undefined);

  return (
    <div className="ui-page-scroll">
      <div className="ui-page more-page">
        <PageHeader title="More" />
        <details className="more-workspace">
          <summary>
            <span className="customer-avatar" aria-hidden>
              <UserRound size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <strong>
                {current?.ownerName || (demoMode ? "Sample workspace" : "Your workspace")}
              </strong>
              <small>{current?.name || "All businesses"}</small>
            </span>
            <ChevronDown size={16} aria-hidden />
          </summary>
          <p className="sr-only">Switch business</p>
          <ul className="mt-1">
            {demoMode ? (
              <li>
                <button
                  type="button"
                  className={cn(
                    "flex min-h-12 w-full items-center rounded-lg px-2 text-left text-sm",
                    filter === "all" ? "font-medium text-ink" : "text-ink-2",
                  )}
                  onClick={() => {
                    setFilter("all");
                    showToday();
                  }}
                >
                  All businesses
                </button>
              </li>
            ) : null}
            {visible.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  className={cn(
                    "flex min-h-12 w-full items-center rounded-lg px-2 text-left text-sm",
                    filter === b.id ? "font-medium text-ink" : "text-ink-2",
                  )}
                  onClick={() => {
                    setFilter(b.id);
                    showToday();
                  }}
                >
                  {b.name}
                </button>
              </li>
            ))}
          </ul>
        </details>
        <ul className="more-destinations">
          <MoreLink to="/usage" icon={Gauge} label="Plan & usage" />
          <MoreLink to="/refer" icon={Gift} label="Refer a friend" />
          <MoreLink to="/support" icon={CircleHelp} label="Help & support" />
          <MoreLink to="/settings" icon={Settings} label="Settings" />
          <MoreLink to="/account" icon={UserRound} label="Account" />
          <MoreLink to="/insights" icon={LineChart} label="Insights" />
          {embed ? null : <MoreLink to="/" icon={Globe} label="Website" />}
        </ul>
        {embed ? null : (
          <details className="more-secondary mt-5 border-t border-line">
            <summary>On this device</summary>
            <InstallAppRow />
          </details>
        )}
        <details className="more-secondary border-t border-line">
          <summary>{demoMode ? "Sample workspace" : "Workspace setup"}</summary>
          <div className="flex flex-col gap-2">
            {/*
              enterSample() overwrites the workspace arrays with fixtures. That
              is fine in demo mode and destructive in a live tenant, so a live
              operator is sent to the isolated /demo surface instead.
            */}
            {demoMode ? (
              <Button
                variant="secondary"
                className="min-h-12 w-full"
                onClick={() => {
                  enterSample();
                  showToday();
                }}
              >
                Open sample jobs
              </Button>
            ) : (
              <Button variant="secondary" className="min-h-12 w-full" asChild>
                <Link to="/demo">See a worked example</Link>
              </Button>
            )}
            <Button variant="ghost" className="min-h-11 w-full" asChild>
              <Link
                to="/onboarding"
                onClick={() => {
                  startSetup();
                }}
              >
                Set up again
              </Link>
            </Button>
          </div>
        </details>
      </div>
    </div>
  );
}

function MoreLink({
  to,
  icon: Icon,
  label,
}: {
  to: "/" | "/account" | "/business" | "/insights" | "/refer" | "/settings" | "/support" | "/usage";
  icon: typeof Globe;
  label: string;
}) {
  return (
    <li>
      <Link
        to={to}
        className="flex min-h-12 items-center gap-3 rounded-lg px-2 py-1.5 active:bg-paper-2"
      >
        <Icon className="size-[18px] text-mark-strong" aria-hidden />
        <span className="flex-1 text-sm font-medium">{label}</span>
        <ChevronRight className="size-4 text-stone" aria-hidden />
      </Link>
    </li>
  );
}
