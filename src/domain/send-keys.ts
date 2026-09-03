import { mayRecordSendViaShortcut } from "./live-demo-isolation";

/**
 * The keyboard-safety policy for the one shortcut that can record a send
 * without the owner clicking a button: the workspace's global Cmd/Ctrl+Enter
 * listener (`workspace.tsx`). Pulled out of that handler's inline
 * conditionals so the actual rule - which keystrokes can ever fire a send -
 * is provable in isolation, not just read from a `useEffect` body.
 *
 * Deliberately narrow. This does not decide what a bare Enter does inside
 * the draft textarea or the approval preview's confirm button - those are
 * left to the browser's own native behaviour on purpose (a `<textarea>`
 * inserts a newline, a focused `<button>` activates on Enter/Space) and
 * carry no app-level interception to extract. Adding one here would be a
 * behaviour change, not a refactor.
 */
export type SendKeyEvent = {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
};

export type SendKeyTarget = {
  /** Whether the event's target sits inside an open dialog/sheet (`role="dialog"`). */
  inDialog: boolean;
};

export type SendKeyDecision = "submit" | "ignore";

/**
 * Whether this keydown should fire the demo-only "record as sent" shortcut.
 *
 * - Anything other than Cmd/Ctrl+Enter is `"ignore"` - a bare Enter,
 *   wherever it is pressed (the draft textarea included), never submits.
 * - Cmd/Ctrl+Enter inside an open dialog is `"ignore"`: the approval
 *   preview owns its own confirm button, and this global shortcut must
 *   never race it or double-fire alongside it.
 * - Cmd/Ctrl+Enter outside a dialog is `"submit"` only when
 *   `mayRecordSendViaShortcut(demoMode)` allows it - never in live mode,
 *   where the only way to record a send is the approval preview's own
 *   button.
 */
export function resolveSendKey(
  event: SendKeyEvent,
  target: SendKeyTarget,
  demoMode: boolean,
): SendKeyDecision {
  if (!((event.metaKey || event.ctrlKey) && event.key === "Enter")) return "ignore";
  if (target.inDialog) return "ignore";
  if (!mayRecordSendViaShortcut(demoMode)) return "ignore";
  return "submit";
}
