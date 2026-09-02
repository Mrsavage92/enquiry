import { usePrototype } from "@/store/prototype-store";
import { authEnabled } from "@/lib/auth/client";
import {
  setActionPolicyMode,
  setBusinessPause,
  setEnquiryNote,
  snoozeEnquiry,
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

/**
 * Enquiry-level mutations that must survive a reload.
 *
 * `setEnquiryNote` and `snoozeEnquiry` existed server-side but nothing called
 * them, so a note an operator wrote about a customer lived in browser memory
 * and disappeared. Built-but-unwired server code is worse than none: it makes
 * persistence coverage look better than it is.
 */
export function useLiveEnquiryMutations() {
  const demoMode = usePrototype((s) => s.demoMode);
  const setNoteLocal = usePrototype((s) => s.setNote);
  const snoozeLocal = usePrototype((s) => s.snooze);
  const live = liveMode(demoMode);

  return {
    live,
    setNote: async (enquiryId: string, note: string, onFailure: (m: string) => void) => {
      setNoteLocal(enquiryId, note);
      if (!live) return;
      await writeThrough("Note", () => setEnquiryNote({ data: { enquiryId, note } }), onFailure);
    },
    snooze: async (enquiryId: string, onFailure: (m: string) => void) => {
      snoozeLocal(enquiryId);
      if (!live) return;
      // The store computes the snooze date itself, so read back what it decided
      // rather than recomputing here - two independent "+2 days" calculations
      // would drift and the server would hold a different date to the screen.
      const until =
        usePrototype.getState().enquiries.find((e) => e.id === enquiryId)?.snoozedUntil ?? null;
      await writeThrough("Snooze", () => snoozeEnquiry({ data: { enquiryId, until } }), onFailure);
    },
  };
}

/**
 * The first-beta loop, client side.
 *
 * These have no demo equivalent: they are the real product. Each one calls a
 * tenancy-checked server function and refetches, because unlike a filter or a
 * tab these change what the business actually is.
 */
export function useFirstBetaActions() {
  const hydrate = usePrototype((s) => s.hydrateFromServer);

  const refresh = async () => {
    const { fetchWorkspace } = await import("@/lib/server/workspace");
    const data = await fetchWorkspace();
    if (!data.needsOnboarding) {
      hydrate({
        businesses: data.businesses,
        enquiries: data.enquiries,
        bookings: data.bookings,
        audit: data.audit,
      });
    }
  };

  return {
    /** Save a confirmed pricing rule, then reload so it can price immediately. */
    saveRule: async (businessId: string, rule: unknown) => {
      const { saveBusinessRule } = await import("@/lib/server/enquiry-actions");
      await saveBusinessRule({ data: { businessId, rule } });
      await refresh();
    },
    /** Add an enquiry the owner typed in. Returns its id so the UI can open it. */
    addEnquiry: async (input: {
      businessId: string;
      body: string;
      customerName?: string;
      customerEmail?: string;
      customerPhone?: string;
      serviceLabel?: string;
      intakeNote?: string;
    }) => {
      const { createManualEnquiry } = await import("@/lib/server/enquiry-actions");
      const res = await createManualEnquiry({ data: input });
      await refresh();
      return res.enquiryId;
    },
    /** Record that the owner sent the reply themselves. */
    recordSent: async (enquiryId: string, body: string, channel = "manual") => {
      const { recordSentReply } = await import("@/lib/server/enquiry-actions");
      await recordSentReply({ data: { enquiryId, body, channel } });
      await refresh();
    },
    refresh,
  };
}
