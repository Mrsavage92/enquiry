import { useCallback, useEffect, useRef, useState } from "react";
import type { PrepareReviewResult } from "@/lib/repo/reviewed-send-core";
import { useFirstBetaActions } from "@/lib/workspace/live-mutations";
import { CHECK_IDLE_MS, CHECK_TIMEOUT_MS, checkDelay } from "@/domain/send-flow";

export type CheckOk = Extract<PrepareReviewResult, { ok: true }>;
export type CheckRefused = Extract<PrepareReviewResult, { ok: false }>;

export type CheckState =
  | { status: "off" }
  | { status: "checking"; text: string; revision: number }
  | { status: "ok"; text: string; revision: number; result: CheckOk }
  | { status: "refused"; text: string; revision: number; result: CheckRefused }
  | { status: "failed"; text: string; revision: number };

/**
 * The send check before the tap (doc 50 7.1), on the existing prepare: it
 * freezes exactly the text on screen and says whether it may go. It runs when
 * the screen opens on a send step, after a second without typing, on blur, and
 * at once after a decision rewrites the reply; at most one starts every two
 * seconds per enquiry and at most one is in flight, and the newest text wins.
 * A check that does not answer in five seconds is a failed check, never a
 * spinner left running.
 */
export function useSendCheck(input: {
  enquiryId: string;
  text: string;
  revision: number;
  channel: string;
  eligible: boolean;
  editing: boolean;
}): { state: CheckState; retry: () => void; current: boolean } {
  const { enquiryId, text, revision, channel, eligible, editing } = input;
  const actions = useFirstBetaActions();
  const [state, setState] = useState<CheckState>({ status: "off" });
  const [nonce, setNonce] = useState(0);
  const lastStart = useRef<number | null>(null);
  const inFlight = useRef(false);
  const wanted = useRef({ text, revision });
  wanted.current = { text, revision };

  // Already checked, checking, or failed for exactly this text: nothing new to
  // start (a failed check waits for Try again rather than retrying by itself).
  const settledFor = state.status !== "off" && state.text === text && state.revision === revision;

  useEffect(() => {
    if (!eligible) {
      setState({ status: "off" });
      return;
    }
    if (settledFor || !text.trim()) return;
    const wait = Math.max(editing ? CHECK_IDLE_MS : 0, checkDelay(lastStart.current, Date.now()));
    const timer = window.setTimeout(() => {
      if (inFlight.current) return;
      const want = { text, revision };
      inFlight.current = true;
      lastStart.current = Date.now();
      setState({ status: "checking", ...want });
      let timeout: number | undefined;
      const late = new Promise<"timeout">((resolve) => {
        timeout = window.setTimeout(() => resolve("timeout"), CHECK_TIMEOUT_MS);
      });
      void Promise.race([actions.prepareReview(enquiryId, want.text, channel), late])
        .then(
          (res) => {
            const fresh =
              wanted.current.text === want.text && wanted.current.revision === want.revision;
            if (!fresh) return;
            if (res === "timeout") setState({ status: "failed", ...want });
            else if (res.ok) setState({ status: "ok", ...want, result: res });
            else setState({ status: "refused", ...want, result: res });
          },
          () => setState({ status: "failed", ...want }),
        )
        .finally(() => {
          window.clearTimeout(timeout);
          inFlight.current = false;
          // A newer text arrived while this one was out: check that one next.
          setNonce((n) => n + 1);
        });
    }, wait);
    return () => window.clearTimeout(timer);
    // `settledFor` already folds text and revision in; `actions` is stable per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligible, text, revision, editing, enquiryId, channel, nonce, settledFor]);

  const retry = useCallback(() => {
    setState({ status: "off" });
    setNonce((n) => n + 1);
  }, []);

  return { state, retry, current: settledFor && state.status === "ok" };
}
