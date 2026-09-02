import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/shell/app-shell";
import { RequireAuth } from "@/lib/auth/gates";
import { WorkspaceBoundary } from "@/components/shell/workspace-boundary";

/**
 * Every operator surface hangs off this layout - enquiries, bookings, business,
 * insights, settings, trust, lab. The guard lives here rather than on each child
 * so a new route under /_app cannot be added unprotected by omission.
 */
export const Route = createFileRoute("/_app")({
  component: GuardedAppShell,
});

function GuardedAppShell() {
  return (
    <RequireAuth>
      {/*
        One boundary for the whole operator app: auth is verified first, then
        the authenticated workspace is read once and cached into the store.
        Screens below render tenant data only after that has happened, so none
        of them can flash fixtures while the server call is in flight.
      */}
      <WorkspaceBoundary>
        <AppShell />
      </WorkspaceBoundary>
    </RequireAuth>
  );
}
