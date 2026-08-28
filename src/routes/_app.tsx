import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/shell/app-shell";
import { RequireAuth } from "@/lib/auth/gates";

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
      <AppShell />
    </RequireAuth>
  );
}
