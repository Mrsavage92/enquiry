import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useNarrow } from "@/lib/use-narrow";

export const Route = createFileRoute("/_app/trust")({
  component: TrustLayout,
});

const TABS = [
  { to: "/trust", label: "Overview", exact: true },
  { to: "/trust/access", label: "Access" },
  { to: "/trust/automation", label: "Automation" },
  { to: "/trust/audit", label: "Audit" },
] as const;

function TrustLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const phone = useNarrow(860) !== false;
  return (
    <div>
      {phone ? null : (
      <div className="border-b border-line px-4">
        <div className="mx-auto flex max-w-3xl gap-1 overflow-x-auto" role="tablist" aria-label="Trust sections">
          {TABS.map((t) => {
            const active = "exact" in t && t.exact ? pathname === t.to : pathname.startsWith(t.to);
            return (
              <Link
                key={t.to}
                to={t.to}
                aria-current={active ? "page" : undefined}
                className={cn("doc-tab shrink-0")}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      </div>
      )}
      <Outlet />
    </div>
  );
}
