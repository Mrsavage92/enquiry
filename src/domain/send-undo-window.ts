import type { Enquiry } from "./types";

/**
 * How long a recorded send can be undone. Must equal the server's own window
 * (`UNDO_SEND_WINDOW_MS` in lib/repo/undo-send-core.ts, asserted by a test):
 * the enquiry offers Undo for exactly as long as the server will honour it.
 */
export const SEND_UNDO_WINDOW_MS = 15 * 60_000;

/**
 * The recorded send that can still be undone from the enquiry itself, and how
 * long is left. The toast's Undo is gone in seconds; an owner who looks back a
 * few minutes later still needs a way out of a mis-tap.
 */
export function undoableSend(
  enquiry: Pick<Enquiry, "conversation" | "state" | "practice">,
  now = Date.now(),
): { messageId: string; msLeft: number } | null {
  if (enquiry.state.lifecycle !== "OPEN" || enquiry.practice) return null;
  const last = enquiry.conversation[enquiry.conversation.length - 1];
  // Anything after the send (their reply) makes it history, as on the server.
  if (!last || last.direction !== "outbound") return null;
  // Only a send the server can undo: one backed by a reviewed artefact.
  if (!last.reviewed) return null;
  // The same clock as the server: sent_at, falling back to the message time.
  const at = Date.parse(last.sentAt ?? last.at);
  if (!Number.isFinite(at)) return null;
  const msLeft = SEND_UNDO_WINDOW_MS - (now - at);
  return msLeft > 0 ? { messageId: last.id, msLeft } : null;
}
