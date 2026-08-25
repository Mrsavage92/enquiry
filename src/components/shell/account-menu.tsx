import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { Link } from "@tanstack/react-router";
import { ChevronDown, FlaskConical, Pause, RotateCcw, Settings, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BUSINESSES } from "@/fixtures";
import { usePrototype } from "@/store/prototype-store";

export function AccountMenu({
  compact,
  inverse,
}: {
  compact?: boolean;
  inverse?: boolean;
}) {
  const filter = usePrototype((s) => s.businessFilter);
  const setFilter = usePrototype((s) => s.setBusinessFilter);
  const pause = usePrototype((s) => s.pause);
  const resume = usePrototype((s) => s.resume);
  const businesses = usePrototype((s) => s.businesses);
  const paused = businesses.some((b) => b.paused);
  const reset = usePrototype((s) => s.reset);
  const startSetup = usePrototype((s) => s.startSetup);
  const workspaceLabel =
    filter === "all" ? "All businesses" : businesses.find((b) => b.id === filter)?.name ?? "Workspace";
  const demoMode = usePrototype((s) => s.demoMode);
  const visibleBusinesses = demoMode ? BUSINESSES : businesses.filter((b) => b.id === "glow");

  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <Button
          variant={inverse ? "inverse" : "ghost"}
          size={compact ? "icon" : "md"}
          className={compact ? "size-11" : "w-full justify-between px-3"}
          aria-label="Account menu"
        >
          <span className="flex items-center gap-2">
            <span
              className={
                inverse
                  ? "grid size-6 place-items-center rounded-full bg-sidebar-fg/10 text-sidebar-fg"
                  : "grid size-6 place-items-center rounded-full bg-paper-2 text-ink-2"
              }
            >
              <UserRound className="size-3.5" aria-hidden />
            </span>
            {compact ? null : <span className="truncate text-left">{workspaceLabel}</span>}
          </span>
          {compact ? null : <ChevronDown className="size-3.5 opacity-60" aria-hidden />}
        </Button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          align={compact ? "end" : "start"}
          side={compact ? "bottom" : "top"}
          className="z-50 w-64 origin-bottom rounded-lg bg-raised p-1.5 shadow-float data-[state=open]:animate-menu-in"
        >
          <p className="eyebrow px-2 py-2">Working as</p>
          <Dropdown.RadioGroup value={filter} onValueChange={(v) => setFilter(v)}>
            {demoMode ? (
              <Dropdown.RadioItem
                value="all"
                className="rounded-md px-2 py-2 text-sm outline-none data-[highlighted]:bg-paper-2"
              >
                All businesses
              </Dropdown.RadioItem>
            ) : null}
            {visibleBusinesses.map((b) => (
              <Dropdown.RadioItem
                key={b.id}
                value={b.id}
                className="rounded-md px-2 py-2 text-sm outline-none data-[highlighted]:bg-paper-2"
              >
                {b.name}
              </Dropdown.RadioItem>
            ))}
          </Dropdown.RadioGroup>
          <Dropdown.Separator className="my-1.5 h-px bg-line" />
          <Dropdown.Item asChild>
            <Link
              to="/"
              className="flex items-center gap-2 rounded-md px-2 py-2 text-sm outline-none data-[highlighted]:bg-paper-2"
            >
              Enquiry website
            </Link>
          </Dropdown.Item>
          <Dropdown.Item asChild>
            <Link
              to="/settings"
              className="flex items-center gap-2 rounded-md px-2 py-2 text-sm outline-none data-[highlighted]:bg-paper-2"
            >
              <Settings className="size-4" aria-hidden />
              Settings
            </Link>
          </Dropdown.Item>
          <Dropdown.Item asChild>
            <Link
              to="/onboarding"
              onClick={() => startSetup()}
              className="flex items-center gap-2 rounded-md px-2 py-2 text-sm outline-none data-[highlighted]:bg-paper-2"
            >
              Set up Business Brain
            </Link>
          </Dropdown.Item>
          <Dropdown.Item
            className="flex items-center gap-2 rounded-md px-2 py-2 text-sm outline-none data-[highlighted]:bg-paper-2"
            onSelect={() => {
              const id = filter === "all" ? businesses[0]?.id : filter;
              if (!id) return;
              if (paused) resume(id);
              else pause(id, "outbound");
            }}
          >
            <Pause className="size-4" aria-hidden />
            {paused ? "Resume Enquiry" : "Pause Enquiry"}
          </Dropdown.Item>
          <Dropdown.Item asChild>
            <Link
              to="/lab"
              className="flex items-center gap-2 rounded-md px-2 py-2 text-sm outline-none data-[highlighted]:bg-paper-2"
            >
              <FlaskConical className="size-4" aria-hidden />
              Fixture lab
            </Link>
          </Dropdown.Item>
          <Dropdown.Item
            className="flex items-center gap-2 rounded-md px-2 py-2 text-sm outline-none data-[highlighted]:bg-paper-2"
            onSelect={() => reset()}
          >
            <RotateCcw className="size-4" aria-hidden />
            Reset prototype
          </Dropdown.Item>
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
