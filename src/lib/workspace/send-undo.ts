import { toast } from "sonner";

/** How long the Undo stays on screen; the server allows longer (undo-send-core.ts). */
export const SEND_UNDO_TOAST_MS = 12_000;

/**
 * The "Recorded as sent" toast, with an Undo that really undoes.
 *
 * The demo's Undo reverted a browser store; a live send had no Undo at all,
 * so a mis-tap left a customer marked as quoted. This one asks the server to
 * remove exactly what the confirmation created (tenant-checked there) and says
 * plainly whether it did.
 */
export function toastRecordedSend(
  message: string,
  undo: (() => Promise<{ ok: boolean; message?: string }>) | null,
): void {
  if (!undo) {
    toast.success(message);
    return;
  }
  toast.success(message, {
    duration: SEND_UNDO_TOAST_MS,
    action: {
      label: "Undo",
      onClick: () => {
        void undo()
          .then((res) => {
            if (res.ok) toast("Send record removed. The reply is ready to check again.");
            else toast.error(res.message ?? "Could not undo that send record.");
          })
          .catch((err: unknown) =>
            toast.error(err instanceof Error ? err.message : "Could not undo that send record."),
          );
      },
    },
  });
}
