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
import { writeThrough } from "./write-through";

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

export function useLiveTrustMutations() {
  const demoMode = usePrototype((s) => s.demoMode);
  const pause = usePrototype((s) => s.pause);
  const resume = usePrototype((s) => s.resume);
  const setPolicyLocal = usePrototype((s) => s.setActionPolicy);
  const setModeLocal = usePrototype((s) => s.setTrustMode);
  const live = liveMode(demoMode);

  return {
    live,
    /**
     * These four stay fire-and-forget: callers `void` them rather than
     * chaining on success, so a failed write already surfaces correctly
     * through `onFailure` alone (a toast) with no dialog or navigation to
     * gate. The boolean is returned for consistency with `writeThrough` and
     * for any future caller that does need to chain on it.
     */
    pauseBusiness: async (
      businessId: string,
      level: "outbound" | "all",
      onFailure: (m: string) => void,
    ): Promise<boolean> => {
      pause(businessId, level);
      if (!live) return true;
      return writeThrough(
        "Pause",
        () => setBusinessPause({ data: { businessId, level } }),
        onFailure,
      );
    },
    resumeBusiness: async (
      businessId: string,
      onFailure: (m: string) => void,
    ): Promise<boolean> => {
      resume(businessId);
      if (!live) return true;
      return writeThrough(
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
    ): Promise<boolean> => {
      setPolicyLocal(businessId, action as never, mode);
      if (!live) return true;
      return writeThrough(
        "Autonomy change",
        () => setActionPolicyMode({ data: { businessId, action, mode } }),
        onFailure,
      );
    },
    setTrustMode: async (
      businessId: string,
      mode: TrustMode,
      onFailure: (m: string) => void,
    ): Promise<boolean> => {
      setModeLocal(businessId, mode);
      if (!live) return true;
      return writeThrough(
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
  const declineLetterLocal = usePrototype((s) => s.declineLetter);
  const closeDeclinedLocal = usePrototype((s) => s.closeDeclined);
  const live = liveMode(demoMode);

  return {
    live,
    // Fire-and-forget, like the trust mutations above: callers `void` these
    // and rely on `onFailure` alone for the error toast.
    setNote: async (
      enquiryId: string,
      note: string,
      onFailure: (m: string) => void,
    ): Promise<boolean> => {
      setNoteLocal(enquiryId, note);
      if (!live) return true;
      return writeThrough("Note", () => setEnquiryNote({ data: { enquiryId, note } }), onFailure);
    },
    snooze: async (enquiryId: string, onFailure: (m: string) => void): Promise<boolean> => {
      snoozeLocal(enquiryId);
      if (!live) return true;
      // The store computes the snooze date itself, so read back what it decided
      // rather than recomputing here - two independent "+2 days" calculations
      // would drift and the server would hold a different date to the screen.
      const until =
        usePrototype.getState().enquiries.find((e) => e.id === enquiryId)?.snoozedUntil ?? null;
      return writeThrough("Snooze", () => snoozeEnquiry({ data: { enquiryId, until } }), onFailure);
    },
    /**
     * Decline an enquiry. Demo mode keeps its existing scripted behaviour
     * (declineLetter's fabricated letter is a narrated demo beat, store-only,
     * exactly as before).
     *
     * A live enquiry gets the honest version, and that now means the local
     * close is applied only once the server has confirmed it, not before.
     * Closing it locally first and writing through second (the previous
     * order) meant a failed write still left the enquiry showing DECLINED on
     * screen - the UI and the database disagreeing about whether the
     * customer's request was actually closed. Callers use the returned
     * boolean to decide whether to show success (toast, close the dialog,
     * advance) or leave the enquiry exactly where the operator found it.
     */
    decline: async (
      enquiryId: string,
      reason: string,
      onFailure: (m: string) => void,
    ): Promise<boolean> => {
      if (demoMode) {
        declineLetterLocal(enquiryId);
        return true;
      }
      if (!live) {
        // No server to confirm against (auth disabled / local prototype) -
        // the local close is the only record there is, as before.
        closeDeclinedLocal(enquiryId, reason);
        return true;
      }
      const { declineEnquiry } = await import("@/lib/server/enquiry-actions");
      const ok = await writeThrough(
        "Decline",
        () => declineEnquiry({ data: { enquiryId, reason } }),
        onFailure,
      );
      if (ok) closeDeclinedLocal(enquiryId, reason);
      return ok;
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
    /** Answer the fact an enquiry is blocked on, then reload the new decision. */
    answerFact: async (enquiryId: string, field: string, value: string) => {
      const { answerEnquiryFact } = await import("@/lib/server/enquiry-actions");
      const res = await answerEnquiryFact({ data: { enquiryId, field, value } });
      await refresh();
      return res;
    },
    /** Correct or confirm what the model read as the service, then reload. */
    setService: async (enquiryId: string, serviceLabel: string) => {
      const { setEnquiryService } = await import("@/lib/server/enquiry-actions");
      const res = await setEnquiryService({ data: { enquiryId, serviceLabel } });
      await refresh();
      return res;
    },
    /**
     * Record that the owner sent the reply themselves.
     *
     * `opts.edited` is still accepted so existing callers that pass a
     * client-side edited flag keep compiling, but it is no longer sent to the
     * server - `recordSentReplyInTransaction` now derives `edited` itself
     * from the enquiry's own prepared draft, since a client-reported value
     * can't be told apart from a stale or spoofed one.
     */
    recordSent: async (
      enquiryId: string,
      body: string,
      channel = "manual",
      opts?: { clientRequestId?: string; edited?: boolean },
    ) => {
      const { recordSentReply } = await import("@/lib/server/enquiry-actions");
      const res = await recordSentReply({
        data: {
          enquiryId,
          body,
          channel,
          clientRequestId: opts?.clientRequestId,
        },
      });
      await refresh();
      return res;
    },
    refresh,
  };
}
