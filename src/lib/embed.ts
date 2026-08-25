import { useEffect, useState } from "react";

export function isFramed() {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/** False on the server and the first paint, then true if this window is the site’s phone. */
export function useEmbed() {
  const [embed, setEmbed] = useState(false);
  useEffect(() => setEmbed(isFramed()), []);
  return embed;
}
