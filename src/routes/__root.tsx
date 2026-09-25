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
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

const APP_NAME = "Enquiry";

/**
 * On an enquiry the decision, its buttons and the choices under a changed
 * reply fill the lower screen, so a toast there would cover the very action
 * it reports on. Enquiry screens show toasts at the top, over the header;
 * everywhere else they sit above the phone's bottom navigation.
 */
function AppToaster() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onEnquiry = /^\/enquiries\/[^/]+/.test(pathname);
  return (
    <Toaster
      position={onEnquiry ? "top-center" : "bottom-center"}
      offset={24}
      mobileOffset={onEnquiry ? { top: 8 } : { bottom: 96 }}
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
