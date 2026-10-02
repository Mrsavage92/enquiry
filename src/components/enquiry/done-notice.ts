import { createContext, useContext } from "react";
import { toast } from "sonner";

/**
 * What an answered decision did, said once. On the laser screen it is a polite
 * live-region line beside the reply, whose changed sentence is highlighted
 * (doc 50 6.1: no success toast after each answer). Anywhere else it stays a
 * toast, as before.
 */
const DoneContext = createContext<((message: string) => void) | null>(null);

export const DoneProvider = DoneContext.Provider;

export function useDone(): (message: string) => void {
  const say = useContext(DoneContext);
  return (message: string) => {
    toast.dismiss();
    if (say) say(message);
    else toast.success(message);
  };
}
