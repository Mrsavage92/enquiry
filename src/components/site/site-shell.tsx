import { Link, useRouterState } from "@tanstack/react-router";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { Wordmark } from "@/components/ui/wordmark";
import { captureAttribution, currentTouch, launchSessionId } from "@/lib/launch/session";
import { trackLaunchEvent } from "@/lib/launch/api";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/site/contact";

const NAV = [
  { to: "/how", label: "How it works" },
  { to: "/demo", label: "Demo" },
  { to: "/roadmap", label: "Roadmap" },
  { to: "/updates", label: "Updates" },
] as const;

/** Desktop header carries three destinations; Updates lives in the footer and the mobile menu. */
const DESKTOP_NAV = NAV.filter((item) => item.to !== "/updates");

export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

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

  function trackJoin() {
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
  }

  return (
    <div className="public-site">
      <a className="public-skip" href="#site-main">
        Skip to content
      </a>
      <header
        className="public-nav"
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            setOpen(false);
            menuButton.current?.focus();
          }
        }}
      >
        <div className="public-container public-nav-inner">
          <Link to="/" aria-label="Enquiry home" className="public-wordmark">
            <Wordmark size="sm" />
          </Link>
          <nav className="public-desktop-links" aria-label="Site">
            {DESKTOP_NAV.map(({ to, label }) => (
              <Link key={to} to={to} aria-current={pathname === to ? "page" : undefined}>
                {label}
              </Link>
            ))}
          </nav>
          <div className="public-nav-actions">
            <Link to="/login" className="public-signin">
              Sign in
            </Link>
            <Link to="/early-access" className="public-nav-join" onClick={trackJoin}>
              Join early access
            </Link>
            <button
              ref={menuButton}
              type="button"
              className="public-menu-toggle"
              aria-label={open ? "Close navigation" : "Open navigation"}
              title={open ? "Close navigation" : "Open navigation"}
              aria-expanded={open}
              aria-controls="site-menu"
              onClick={() => setOpen(!open)}
            >
              {open ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
            </button>
          </div>
        </div>
        <nav id="site-menu" className="public-mobile-menu" aria-label="Mobile site" hidden={!open}>
          <Link to="/" onClick={() => setOpen(false)}>
            Home
          </Link>
          {NAV.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              aria-current={pathname === to ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              {label}
            </Link>
          ))}
          <Link to="/login" onClick={() => setOpen(false)}>
            Sign in
          </Link>
        </nav>
      </header>
      <main id="site-main" tabIndex={-1}>
        {children}
      </main>
      <footer className="public-footer">
        <div className="public-container public-footer-main">
          <div>
            <Link to="/" className="public-wordmark" aria-label="Enquiry home">
              <Wordmark />
            </Link>
            <p>
              For the person behind the business.
              <br />
              Know what you can promise, every day.
            </p>
          </div>
          <nav aria-label="Explore">
            <h2>Explore</h2>
            {NAV.map(({ to, label }) => (
              <Link key={to} to={to}>
                {label}
              </Link>
            ))}
          </nav>
          <nav aria-label="Get started">
            <h2>Get started</h2>
            <Link to="/early-access">Join early access</Link>
            <Link to="/" hash="questions-title">
              Questions
            </Link>
            <Link to="/login">Sign in</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <a href={SUPPORT_MAILTO}>Contact</a>
          </nav>
        </div>
        <div className="public-container public-footer-bottom">
          <span>Enquiry</span>
          <span>
            Built with small service businesses in mind. Questions:{" "}
            <a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a>
          </span>
        </div>
      </footer>
    </div>
  );
}
