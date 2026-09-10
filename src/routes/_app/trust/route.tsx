import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/trust")({
  component: TrustLayout,
});

const TABS = [
  { to: "/trust/access", label: "Connections" },
  { to: "/trust", label: "Reply settings", exact: true },
  { to: "/trust/automation", label: "Permissions" },
  { to: "/trust/audit", label: "Activity" },
] as const;

function TrustLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="ui-page-scroll">
      <div className="border-b border-line px-4">
        <nav
          className="mx-auto flex max-w-3xl gap-1 overflow-x-auto"
          aria-label="Connection and reply settings"
        >
          {TABS.map((t) => {
            const active = "exact" in t && t.exact ? pathname === t.to : pathname.startsWith(t.to);
            return (
              <Link
                key={t.to}
                to={t.to}
                aria-current={active ? "page" : undefined}
                className="doc-tab shrink-0"
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
