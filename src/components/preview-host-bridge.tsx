/**
 * Mount once in `__root.tsx` so the Grok preview chrome can drive navigation
 * (and later receive registered routes). Noops when the app is not embedded.
 */

import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import {
  collectRoutePathsFromTree,
  installPreviewHostBridge,
} from "@/lib/preview-host-bridge";
import { isFramed } from "@/lib/embed";

export function PreviewHostBridge() {
  const router = useRouter();

  useEffect(() => {
    if (!isFramed()) return;
    document.documentElement.classList.add("embed");
    return () => document.documentElement.classList.remove("embed");
  }, []);

  useEffect(() => {
    return installPreviewHostBridge({
      navigate: (path) => {
        router.history.push(path);
      },
      getRoutePaths: () => collectRoutePathsFromTree(router.routeTree),
    });
  }, [router]);

  return null;
}