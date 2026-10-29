import { LogOut } from "lucide-react";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { useCanSignOut, useSignOut } from "./use-sign-out";

/** The signed-in email and a sign-out button, for the Account page (reachable on a phone). */
export function SignOutPanel() {
  const user = useCurrentUser();
  const canSignOut = useCanSignOut();
  const { busy, run } = useSignOut();
  if (!canSignOut || !user) return null;
  return (
    <section className="account-identity" aria-label="Signed in">
      <span className="account-feature-icon">
        <LogOut size={24} strokeWidth={1.5} aria-hidden="true" />
      </span>
      <div>
        <p className="text-sm text-stone">Signed in as</p>
        <p className="mt-1 text-base text-ink">{user.primaryEmail ?? "your account"}</p>
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="mt-3 inline-flex min-h-11 items-center rounded-md border border-line bg-raised px-4 text-sm font-medium text-ink hover:bg-paper-2 disabled:cursor-wait"
        >
          {busy ? "Signing out..." : "Sign out"}
        </button>
      </div>
    </section>
  );
}
