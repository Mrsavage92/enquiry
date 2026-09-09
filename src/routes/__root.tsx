import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { PaletteFlag } from "@/components/palette-flag";
import { PALETTE_INLINE_SCRIPT } from "@/lib/palette-flag";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

const APP_NAME = "Enquiry";

export const Route = createRootRoute({
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
      { name: "theme-color", content: "#faf7f1" },
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
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Serif:wght@500;600&display=swap",
      },
      /*
        Marketing routes only (the `html[data-site="marketing"]` layer at the
        end of styles.css). The mirrored reference computes to "Inter
        Variable" - its self-hosted name for Inter v4 variable. Google Fonts
        serves the identical variable typeface as family "Inter" with the wght
        and opsz axes, so the reference's 400 / 510 / 590 weights are all
        reachable. A remote `@import` in styles.css is stripped by the
        Tailwind/Vite pipeline, so it is loaded here instead.
      */
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400..700&display=swap",
      },
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
        <Toaster
          position="bottom-center"
          offset={24}
          mobileOffset={24}
          toastOptions={{
            className: "font-sans text-ink bg-raised shadow-float",
          }}
        />
        <Scripts />
      </body>
    </html>
  ),
});
