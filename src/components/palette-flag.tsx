import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { syncPaletteFromLocation } from "@/lib/palette-flag";

/**
 * Re-applies the `?palette=` flag on client-side (SPA) navigation.
 *
 * The inline script in src/routes/__root.tsx's <head> handles the first
 * paint / full-reload case, before React ever runs. This component covers
 * in-app Link navigation, where the head script does not re-run but the URL
 * search string still changes. Renders nothing; it is a side-effect-only
 * mount, same pattern as PreviewHostBridge in __root.tsx.
 */
export function PaletteFlag() {
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  useEffect(() => {
    syncPaletteFromLocation();
  }, [searchStr]);
  return null;
}
