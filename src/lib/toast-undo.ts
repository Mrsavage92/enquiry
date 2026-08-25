import { toast } from "sonner";
import { usePrototype } from "@/store/prototype-store";

export function toastUndo(message: string) {
  toast(message, {
    action: {
      label: "Undo",
      onClick: () => usePrototype.getState().undoLast(),
    },
  });
}
