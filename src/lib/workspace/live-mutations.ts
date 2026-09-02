import { usePrototype } from "@/store/prototype-store";
import { authEnabled } from "@/lib/auth/client";
import {
  setActionPolicyMode,
  setBusinessPause,
  setTrustMode as setTrustModeServer,
} from "@/lib/server/workspace";
import type { ActionPolicyMode, TrustMode } from "@/domain/types";

/**
 * Trust and business mutations that must survive a reload.
 *
 * The store still updates immediately so the UI stays responsive, but in live
 * mode the server is the authority: the same change is written through, and a
 * failed write is surfaced rather than swallowed. Leaving an operator believing
 * they had paused outbound sending when the server never recorded it is the
 * kind of silent failure this product cannot afford.
 *
 * In demo mode these are store-only, exactly as before.
 */

function liveMode(demoMode: boolean): boolean {
  return authEnabled && !demoMode;
}

/** Report a failed write without pretending it succeeded. */
async function writeThrough(
  label: string,
  run: () => Promise<unknown>,
  onFailure: (message: string) => void,
): Promise<void> {
  try {
    await run();
  } catch (err) {
    onFailure(
      err instanceof Error && err.message
        ? `${label} was not saved: ${err.message}`
        : `${label} was not saved. Please try again.`,
    );
  }
}

export function useLiveTrustMutations() {
  const demoMode = usePrototype((s) => s.demoMode);
  const pause = usePrototype((s) => s.pause);
  const resume = usePrototype((s) => s.resume);
  const setPolicyLocal = usePrototype((s) => s.setActionPolicy);
  const setModeLocal = usePrototype((s) => s.setTrustMode);
  const live = liveMode(demoMode);

  return {
    live,
    pauseBusiness: async (
      businessId: string,
      level: "outbound" | "all",
      onFailure: (m: string) => void,
    ) => {
      pause(businessId, level);
      if (!live) return;
      await writeThrough("Pause", () => setBusinessPause({ data: { businessId, level } }), onFailure);
    },
    resumeBusiness: async (businessId: string, onFailure: (m: string) => void) => {
      resume(businessId);
      if (!live) return;
      await writeThrough(
        "Resume",
        () => setBusinessPause({ data: { businessId, level: "none" } }),
        onFailure,
      );
    },
    setActionPolicy: async (
      businessId: string,
      action: string,
      mode: ActionPolicyMode,
      onFailure: (m: string) => void,
    ) => {
      setPolicyLocal(businessId, action as never, mode);
      if (!live) return;
      await writeThrough(
        "Autonomy change",
        () => setActionPolicyMode({ data: { businessId, action, mode } }),
        onFailure,
      );
    },
    setTrustMode: async (
      businessId: string,
      mode: TrustMode,
      onFailure: (m: string) => void,
    ) => {
      setModeLocal(businessId, mode);
      if (!live) return;
      await writeThrough(
        "Trust mode",
        () => setTrustModeServer({ data: { businessId, mode } }),
        onFailure,
      );
    },
  };
}
