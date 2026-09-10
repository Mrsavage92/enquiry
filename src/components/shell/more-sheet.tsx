import { Link } from "@tanstack/react-router";
import { CircleHelp, Gift, Globe, LineChart, Settings, Sparkle, UserRound } from "lucide-react";
import { Dialog as DialogRoot } from "@/components/ui/dialog";
import { SheetContent } from "@/components/ui/sheet";
import { usePrototype } from "@/store/prototype-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BUSINESSES } from "@/fixtures";
import { visibleBusinesses } from "@/lib/workspace/resolve-business";
import { InstallAppRow } from "./install-app";
import { useEmbed } from "@/lib/embed";

export function MoreSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const startSetup = usePrototype((s) => s.startSetup);
  const enterSample = usePrototype((s) => s.enterSample);
  const demoMode = usePrototype((s) => s.demoMode);
  const businesses = usePrototype((s) => s.businesses);
  const filter = usePrototype((s) => s.businessFilter);
  const setFilter = usePrototype((s) => s.setBusinessFilter);
  const close = () => onOpenChange(false);
  const embed = useEmbed();
  // Live mode shows the tenant's own businesses. Filtering to the fixture
  // "glow" id meant a real workspace vanished from its own selector the
  // moment it had a real uuid.
  const visible = visibleBusinesses(businesses, { demoMode, fixtures: BUSINESSES });

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <SheetContent title="More">
        <p className="eyebrow">Working as</p>
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
                  close();
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
                  close();
                }}
              >
                {b.name}
              </button>
            </li>
          ))}
        </ul>
        <Link to="/usage" onClick={close} className="mt-4 block rounded-xl bg-paper-2 p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkle className="size-4 text-mark" aria-hidden />
            Plan & usage
          </div>
          <p className="mt-1 text-xs leading-relaxed text-ink-2">
            Usage limits are not configured yet. This will show the real plan when pricing is set.
          </p>
        </Link>
        <ul className="mt-3 grid gap-1">
          {embed ? null : <MoreLink to="/" onClick={close} icon={Globe} label="Website" />}
          <MoreLink to="/insights" onClick={close} icon={LineChart} label="Insights" />
          <MoreLink to="/refer" onClick={close} icon={Gift} label="Refer a friend" />
          <MoreLink to="/support" onClick={close} icon={CircleHelp} label="Help & support" />
          <MoreLink to="/settings" onClick={close} icon={Settings} label="Settings" />
          <MoreLink to="/account" onClick={close} icon={UserRound} label="Account" />
        </ul>
        {embed ? null : (
          <div className="mt-5 border-t border-line pt-4">
            <p className="eyebrow">This phone</p>
            <InstallAppRow onDone={close} />
          </div>
        )}
        <div className="mt-4 border-t border-line pt-4">
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
                  close();
                }}
              >
                Open sample jobs
              </Button>
            ) : (
              <Button variant="secondary" className="min-h-12 w-full" asChild>
                <Link to="/demo" onClick={close}>
                  See a worked example
                </Link>
              </Button>
            )}
            <Button variant="ghost" className="min-h-11 w-full" asChild>
              <Link
                to="/onboarding"
                onClick={() => {
                  startSetup();
                  close();
                }}
              >
                Set up again
              </Link>
            </Button>
          </div>
        </div>
      </SheetContent>
    </DialogRoot>
  );
}

function MoreLink({
  to,
  onClick,
  icon: Icon,
  label,
}: {
  to: "/" | "/account" | "/business" | "/insights" | "/refer" | "/settings" | "/support" | "/usage";
  onClick: () => void;
  icon: typeof Globe;
  label: string;
}) {
  return (
    <li>
      <Link
        to={to}
        onClick={onClick}
        className="flex min-h-12 items-center gap-3 rounded-lg px-2 py-1.5 active:bg-paper-2"
      >
        <Icon className="size-5 text-stone" aria-hidden />
        <span className="text-sm font-medium">{label}</span>
      </Link>
    </li>
  );
}
