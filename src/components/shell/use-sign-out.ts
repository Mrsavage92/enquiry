import { useState } from "react";
import { toast } from "sonner";
import { authEnabled, signOut } from "@/lib/auth/client";
import { useCurrentUser } from "@/lib/auth/use-current-user";

/** True when there is a real signed-in session to end (never for the local dev user). */
export function useCanSignOut(): boolean {
  const user = useCurrentUser();
  return authEnabled && user !== null;
}

/** Ends the session. Success navigates away; a failure says so and can be retried. */
export function useSignOut(): { busy: boolean; run: () => void } {
  const [busy, setBusy] = useState(false);
  const run = () => {
    if (busy) return;
    setBusy(true);
    signOut().catch(() => {
      setBusy(false);
      toast.error("Couldn't sign you out. Check your connection, then try again.");
    });
  };
  return { busy, run };
}
