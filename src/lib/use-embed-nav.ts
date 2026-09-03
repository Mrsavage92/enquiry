import { createContext, useContext } from "react";

export type EmbedNav = {
  open: (enquiryId: string) => void;
  today: () => void;
};

export const EmbedNavContext = createContext<EmbedNav | null>(null);

export function useEmbedNav() {
  return useContext(EmbedNavContext);
}
