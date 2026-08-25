import { createContext, useContext, type ReactNode } from "react";

type EmbedNav = {
  open: (enquiryId: string) => void;
  today: () => void;
};

const EmbedNavContext = createContext<EmbedNav | null>(null);

export function EmbedNavProvider({
  value,
  children,
}: {
  value: EmbedNav;
  children: ReactNode;
}) {
  return <EmbedNavContext.Provider value={value}>{children}</EmbedNavContext.Provider>;
}

export function useEmbedNav() {
  return useContext(EmbedNavContext);
}
