import { useCallback, useEffect, useRef } from "react";
import { create } from "zustand";
import { toast } from "sonner";
import type { WorkspacePrefs } from "@/domain/types";
import { unsavedDraftIds, usePrototype } from "@/store/prototype-store";
import { writeThrough } from "./write-through";

/**
 * Keeping what an interrupted owner leaves behind (client side).
 *
 * The reply being edited, working hours and notice choices are written to the
 * server as they change, so closing the tab or picking up another device
 * brings back exactly where they were. Demo mode stays browser-only: it has no
 * server workspace to write to.
 */

/** Wait this long after the last keystroke before saving a reply. */
const DRAFT_SAVE_DELAY_MS = 700;

export type DraftSaveState = "saving" | "saved" | "failed";

/** Per-enquiry save state, so the editor can say plainly whether the text is kept. */
export const useDraftSaveState = create<{
  byId: Record<string, DraftSaveState>;
  set: (id: string, state: DraftSaveState) => void;
}>((set) => ({
  byId: {},
  set: (id, state) => set((s) => ({ byId: { ...s.byId, [id]: state } })),
}));

const timers = new Map<string, ReturnType<typeof setTimeout>>();

async function saveNow(enquiryId: string, body: string): Promise<void> {
  const mark = useDraftSaveState.getState().set;
  mark(enquiryId, "saving");
  const { saveReplyDraft } = await import("@/lib/server/owner-state");
  const ok = await writeThrough(
    "Your reply",
    () => saveReplyDraft({ data: { enquiryId, body } }),
    () => undefined,
  );
  // Only clear the unsaved marker if nothing newer was typed meanwhile.
  if (ok && usePrototype.getState().drafts[enquiryId] === body) unsavedDraftIds.delete(enquiryId);
  mark(enquiryId, ok ? "saved" : "failed");
}

function flushAll() {
  for (const [id, timer] of timers) {
    clearTimeout(timer);
    timers.delete(id);
    const body = usePrototype.getState().drafts[id];
    if (body !== undefined) void saveNow(id, body);
  }
}

/**
 * Edit a reply: update the screen at once, save to the server shortly after.
 * Also flushes pending saves when the tab is hidden, which is the moment an
 * interrupted owner walks away.
 */
export function useDraftSaver() {
  const editDraft = usePrototype((s) => s.editDraft);
  const demoMode = usePrototype((s) => s.demoMode);

  useEffect(() => {
    if (demoMode) return;
    const onHide = () => {
      if (document.visibilityState === "hidden") flushAll();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flushAll);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flushAll);
    };
  }, [demoMode]);

  return useCallback(
    (enquiryId: string, body: string) => {
      editDraft(enquiryId, body);
      if (demoMode) return;
      unsavedDraftIds.add(enquiryId);
      useDraftSaveState.getState().set(enquiryId, "saving");
      const existing = timers.get(enquiryId);
      if (existing) clearTimeout(existing);
      timers.set(
        enquiryId,
        setTimeout(() => {
          timers.delete(enquiryId);
          void saveNow(enquiryId, body);
        }, DRAFT_SAVE_DELAY_MS),
      );
    },
    [editDraft, demoMode],
  );
}

/** Change working hours or notices, and keep the change on the server. */
export function usePrefsSaver() {
  const setPrefs = usePrototype((s) => s.setPrefs);
  const demoMode = usePrototype((s) => s.demoMode);
  return useCallback(
    (patch: Partial<WorkspacePrefs>) => {
      setPrefs(patch);
      if (demoMode) return;
      const { businesses, businessFilter } = usePrototype.getState();
      const businessId = businessFilter !== "all" ? businessFilter : businesses[0]?.id;
      if (!businessId) return;
      void (async () => {
        const { saveWorkspacePrefs } = await import("@/lib/server/owner-state");
        await writeThrough(
          "Your settings",
          () => saveWorkspacePrefs({ data: { businessId, prefs: patch } }),
          (m) => toast.error(m),
        );
      })();
    },
    [setPrefs, demoMode],
  );
}

/**
 * Record this visit once per app load, and keep the previous one for Today's
 * "since you were last here" line. A failure only costs that line.
 */
export function useMarkSeen() {
  const demoMode = usePrototype((s) => s.demoMode);
  const businessId = usePrototype((s) => s.businesses[0]?.id);
  const setPrevious = usePrototype((s) => s.setLastSeenPrevious);
  const done = useRef(false);
  useEffect(() => {
    if (demoMode || !businessId || done.current) return;
    done.current = true;
    void (async () => {
      try {
        const { markWorkspaceSeen } = await import("@/lib/server/owner-state");
        const res = await markWorkspaceSeen({ data: { businessId } });
        setPrevious(res.previous);
      } catch (err) {
        console.warn("[owner-sync] could not record this visit", err);
      }
    })();
  }, [demoMode, businessId, setPrevious]);
}

/**
 * Drop an edit the owner chose not to keep: the prepared reply shows again and
 * the saved copy is removed on the server, so it is not offered back later.
 */
export async function discardSavedDraft(enquiryId: string): Promise<void> {
  unsavedDraftIds.delete(enquiryId);
  const timer = timers.get(enquiryId);
  if (timer) {
    clearTimeout(timer);
    timers.delete(enquiryId);
  }
  usePrototype.setState((s) => {
    const drafts = { ...s.drafts };
    delete drafts[enquiryId];
    return { drafts };
  });
  if (usePrototype.getState().demoMode) return;
  const { saveReplyDraft } = await import("@/lib/server/owner-state");
  await writeThrough(
    "Your reply",
    () => saveReplyDraft({ data: { enquiryId, body: "" } }),
    (m) => toast.error(m),
  );
}
