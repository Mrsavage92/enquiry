import type { ReactNode } from "react";
import { EmbedNavContext, type EmbedNav } from "@/lib/use-embed-nav";

export function EmbedNavProvider({ value, children }: { value: EmbedNav; children: ReactNode }) {
  return <EmbedNavContext.Provider value={value}>{children}</EmbedNavContext.Provider>;
}
