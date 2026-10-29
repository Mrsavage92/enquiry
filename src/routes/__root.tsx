import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { PaletteFlag } from "@/components/palette-flag";
import { PALETTE_INLINE_SCRIPT } from "@/lib/palette-flag";
import { useEffect } from "react";
import { useNarrow } from "@/lib/use-narrow";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

const APP_NAME = "Enquiry";

/** Phone width, matching the app shell's narrow layout. */
const PHONE_MAX = 860;
const TOAST_GAP = 8;

/**
 * Where a phone toast may sit: above whatever is pinned to the bottom of the
 * screen - the tab bar, or an open sheet with its actions - and never over
 * the header at the top. Measured from layout (offsetHeight), not from the
 * sheet's slide-in transform, so it is right on the first frame.
 */
function useToastFloor() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (window.innerWidth > PHONE_MAX) {
          root.style.removeProperty("--toast-floor");
          return;
        }
        let floor = 0;
        const pinned = document.querySelectorAll<HTMLElement>(
          // The laser screen's action bar is pinned at the bottom too: a toast
          // over Copy or Yes would swallow the tap.
          '.app-nav, .laser-bar:not([data-hidden]), [role="dialog"][data-state="open"]',
        );
        for (const el of pinned) {
          const style = getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          const atBottom =
            style.position === "fixed"
              ? style.bottom === "0px"
              : Math.abs(rect.bottom - window.innerHeight) < 2;
          if (atBottom) floor = Math.max(floor, el.offsetHeight);
        }
        root.style.setProperty("--toast-floor", `${floor + TOAST_GAP}px`);
      });
    };
    measure();
    const observer = new MutationObserver(measure);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-state", "data-hidden"],
    });
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [pathname]);
}

/**
 * On a phone every toast sits at the bottom, above the tab bar or an open
 * sheet, so it covers neither the header (back button, name) nor the actions
 * pinned at the bottom. On a wider screen an enquiry keeps its toasts at the
 * top, clear of the decision and its buttons in the lower half.
 */
function AppToaster() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onEnquiry = /^\/enquiries\/[^/]+/.test(pathname);
  const narrow = useNarrow(PHONE_MAX);
  useToastFloor();
  return (
    <Toaster
      position={onEnquiry && narrow === false ? "top-center" : "bottom-center"}
      offset={24}
      mobileOffset={{ bottom: 96 }}
      closeButton
      toastOptions={{
        className: "font-sans text-ink bg-raised shadow-float",
      }}
    />
  );
}

export const Route = createRootRoute({
  // One timestamp for the server render and the browser, so anything dated
  // relative to "now" (the sample story) renders the same text on both.
  loader: () => ({ renderedAt: Date.now() }),
  staleTime: Infinity,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: APP_NAME },
      {
        name: "description",
        content:
          "Enquiry learns how a service business works and turns messy inbound enquiries into the correct next decision.",
      },
      { name: "theme-color", content: "#f0eef4" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: APP_NAME },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "mobile-web-app-capable", content: "yes" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  component: () => (
    <html lang="en-AU" suppressHydrationWarning>
      <head>
        {/* Runs before first paint so the ?palette=b flag never flashes the
            default palette first - see src/lib/palette-flag.ts. */}
        <script dangerouslySetInnerHTML={{ __html: PALETTE_INLINE_SCRIPT }} />
        <HeadContent />
      </head>
      <body className="antialiased">
        <PreviewHostBridge />
        <PaletteFlag />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <AppToaster />
        <Scripts />
      </body>
    </html>
  ),
});
