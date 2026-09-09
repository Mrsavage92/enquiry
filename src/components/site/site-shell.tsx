import { Link, useRouterState } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import { Wordmark } from "@/components/ui/wordmark";
import { cn } from "@/lib/utils";
import { captureAttribution, currentTouch, launchSessionId } from "@/lib/launch/session";
import { trackLaunchEvent } from "@/lib/launch/api";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/how", label: "How it works" },
  { to: "/roadmap", label: "Roadmap" },
  { to: "/updates", label: "Updates" },
  { to: "/early-access", label: "Early access" },
] as const;

const FOOTER_LINKS = [
  { to: "/how", label: "How it works" },
  { to: "/roadmap", label: "Roadmap" },
  { to: "/updates", label: "Updates" },
  { to: "/early-access", label: "Early access" },
  { to: "/demo", label: "Demo" },
  { to: "/login", label: "Sign in" },
  { to: "/privacy", label: "Privacy" },
  { to: "/terms", label: "Terms" },
] as const;

/**
 * The reference's page background is near-black while the signed-in app stays
 * light, so the marketing palette is switched on at the document root rather
 * than on a wrapper div - `html` and `body` both paint a background, and a
 * wrapper cannot reach either. Every rule in the marketing layer at the end of
 * styles.css hangs off this attribute, and it is removed on unmount so a
 * client-side navigation into the app restores the light palette.
 *
 * The theme-color meta moves with it: __root.tsx ships the app's #faf7f1, and
 * marketing routes need the reference's page background instead.
 */
function useMarketingChrome() {
  useEffect(() => {
    const root = document.documentElement;
    const previousSite = root.getAttribute("data-site");
    root.setAttribute("data-site", "marketing");

    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const previousTheme = meta?.getAttribute("content") ?? null;
    meta?.setAttribute("content", "#08090a");

    return () => {
      if (previousSite === null) root.removeAttribute("data-site");
      else root.setAttribute("data-site", previousSite);
      if (meta && previousTheme !== null) meta.setAttribute("content", previousTheme);
    };
  }, []);
}

export function SiteShell({ children, notebook }: { children: ReactNode; notebook?: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  useMarketingChrome();

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
    <div className={cn("relative min-h-dvh", notebook && "notebook")}>
      {/*
        Fixed, 72px (64px below 640), 1px translucent bottom border, gradient
        fill over a 20px backdrop blur - the reference's header, measured.
        The wordmark carries an -8px optical pull so its glyph, not its box,
        lands on the same content line as the h1 below it.
      */}
      <header className="mk-nav">
        <div className="mk-container">
          <div className="mk-nav-inner">
            <div className="flex items-center gap-6">
              <Link to="/" aria-label="Enquiry home" className="mk-wordmark">
                <Wordmark size="sm" />
              </Link>
              <nav className="hidden items-center md:flex" aria-label="Site">
                {NAV.map((item) => {
                  const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className="mk-nav-link"
                      data-active={active ? "true" : undefined}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
            <div className="flex items-center gap-2">
              {/*
                Kept visible at every width, like the reference's own "Log in"
                text link beside its Sign up pill (measured: 62px wide at 390
                as well as at 1440).
              */}
              <Link to="/demo" className="mk-nav-link">
                See demo
              </Link>
              <Link
                to="/early-access"
                className="mk-btn mk-btn-primary mk-btn-sm"
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
              <button
                type="button"
                className="mk-nav-link mk-below-md"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-controls="site-menu"
              >
                Menu
              </button>
            </div>
          </div>
        </div>
        {open ? (
          <nav
            id="site-menu"
            className="mk-container border-t border-[var(--mk-border-translucent)] bg-[var(--mk-bg)] pb-3 md:hidden"
            aria-label="Site"
          >
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="flex min-h-12 items-center text-[15px] text-[var(--mk-fg-3)]"
              >
                {item.label}
              </Link>
            ))}
            <Link
              to="/demo"
              onClick={() => setOpen(false)}
              className="flex min-h-12 items-center text-[15px] text-[var(--mk-fg)]"
            >
              See demo
            </Link>
            <Link
              to="/login"
              onClick={() => setOpen(false)}
              className="flex min-h-12 items-center text-[15px] text-[var(--mk-fg-3)]"
            >
              Sign in
            </Link>
          </nav>
        ) : null}
      </header>
      <main className="mk-main relative z-10">{children}</main>
      <footer className="mk-footer relative z-10">
        <div className="mk-container mk-footer-inner">
          <div className="flex flex-col gap-10 sm:flex-row sm:justify-between sm:gap-16">
            <div className="max-w-sm">
              <Wordmark />
              <p className="mk-mini mt-3">
                Enquiry puts the request together and prepares the next action. The app is the desk.
                The website is how you get in.
              </p>
            </div>
            {/*
              The reference footer is a grid of link columns. Its columns carry
              headings ("Product", "Company"); those are copy this pass is not
              allowed to invent, so the columns ship unlabelled and every
              existing link keeps its wording and destination.
            */}
            <div className="grid grid-cols-2 gap-x-16 gap-y-1 sm:grid-cols-2">
              {FOOTER_LINKS.map((item) => (
                <Link key={item.to} to={item.to} className="mk-footer-link">
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
