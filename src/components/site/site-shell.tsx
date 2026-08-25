import { Link, useRouterState } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import { Wordmark } from "@/components/ui/wordmark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { captureAttribution, currentTouch, launchSessionId } from "@/lib/launch/session";
import { trackLaunchEvent } from "@/lib/launch/api";
import { PaperField } from "@/components/site/paper-field";
import { useNarrow } from "@/lib/use-narrow";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/how", label: "How it works" },
  { to: "/roadmap", label: "Roadmap" },
  { to: "/updates", label: "Updates" },
  { to: "/early-access", label: "Early access" },
] as const;

export function SiteShell({ children, notebook }: { children: ReactNode; notebook?: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const phone = useNarrow(860) !== false;

  useEffect(() => {
    captureAttribution();
    const touch = currentTouch();
    void trackLaunchEvent({
      data: {
        sessionId: launchSessionId(),
        event_name: "page_view",
        landing_path: pathname,
        utm_source: touch.utm_source,
        utm_medium: touch.utm_medium,
        utm_campaign: touch.utm_campaign,
        utm_content: touch.utm_content,
        referrer: touch.referrer,
        feature_id: "",
      },
    }).catch(() => undefined);
  }, [pathname]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const prev = history.scrollRestoration;
    history.scrollRestoration = "manual";
    return () => {
      history.scrollRestoration = prev;
    };
  }, []);

  return (
    <div className={cn("relative min-h-dvh bg-paper text-ink", notebook && "notebook")}>
      {notebook || phone ? null : <PaperField />}
      <header
        className={cn(
          "site-nav z-30 border-b border-line bg-paper",
          phone ? "relative" : "sticky top-0 bg-paper/95 backdrop-blur-sm",
        )}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-3">
          <Link to="/" aria-label="Enquiry home" className="inline-flex min-h-11 items-center">
            <Wordmark size="sm" />
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Site">
            {NAV.map((item) => {
              const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm min-h-11 inline-flex items-center",
                    active ? "text-ink font-medium" : "text-ink-2 hover:text-ink",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="min-h-11"
              variant={pathname === "/" ? "secondary" : "primary"}
              asChild
            >
              <Link
                to="/early-access"
                onClick={() => {
                  const touch = currentTouch();
                  void trackLaunchEvent({
                    data: {
                      sessionId: launchSessionId(),
                      event_name: "hero_cta_click",
                      landing_path: pathname,
                      utm_source: touch.utm_source,
                      utm_medium: touch.utm_medium,
                      utm_campaign: touch.utm_campaign,
                      utm_content: touch.utm_content,
                      referrer: touch.referrer,
                      feature_id: "",
                    },
                  }).catch(() => undefined);
                }}
              >
                <span className="sm:hidden">Join</span>
                <span className="hidden sm:inline">Join early access</span>
              </Link>
            </Button>
            <span className="hidden sm:inline-flex">
              <Button size="sm" variant="secondary" className="min-h-11" asChild>
                <Link to="/enquiries">Open the app</Link>
              </Button>
            </span>
            <button
              type="button"
              className="min-h-11 min-w-11 md:hidden text-sm font-medium"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="site-menu"
            >
              Menu
            </button>
          </div>
        </div>
        {open ? (
          <nav id="site-menu" className="border-t border-line px-5 py-3 md:hidden" aria-label="Site">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="flex min-h-12 items-center text-sm"
              >
                {item.label}
              </Link>
            ))}
            <Link
              to="/enquiries"
              onClick={() => setOpen(false)}
              className="flex min-h-12 items-center text-sm font-medium"
            >
              Open the app
            </Link>
          </nav>
        ) : null}
      </header>
      <main className="relative z-10">{children}</main>
      <footer className="relative z-10 border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Wordmark />
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-2">
              An enquiry copilot for service businesses. The app is the desk. The website is how you get in.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <Link to="/how" className="min-h-11 inline-flex items-center text-ink-2 hover:text-ink">
              How it works
            </Link>
            <Link to="/roadmap" className="min-h-11 inline-flex items-center text-ink-2 hover:text-ink">
              Roadmap
            </Link>
            <Link to="/updates" className="min-h-11 inline-flex items-center text-ink-2 hover:text-ink">
              Updates
            </Link>
            <Link to="/early-access" className="min-h-11 inline-flex items-center text-ink-2 hover:text-ink">
              Early access
            </Link>
            <Link to="/enquiries" className="min-h-11 inline-flex items-center text-ink-2 hover:text-ink">
              Open the app
            </Link>
            <Link to="/privacy" className="min-h-11 inline-flex items-center text-ink-2 hover:text-ink">
              Privacy
            </Link>
            <Link to="/terms" className="min-h-11 inline-flex items-center text-ink-2 hover:text-ink">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
