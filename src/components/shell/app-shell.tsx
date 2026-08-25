import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  BookMarked,
  Brain,
  Inbox,
  LineChart,
  MoreHorizontal,
  Pause,
  Shield,
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/ui/wordmark";
import { useNarrow } from "@/lib/use-narrow";
import { usePrototype } from "@/store/prototype-store";
import { queueSection } from "@/domain/labels";
import { AccountMenu } from "./account-menu";
import { SystemBanners } from "./system-banners";
import { Jump, JumpTrigger } from "./jump";
import { KeysHelp } from "./keys";
import { Notices } from "./notices";
import { MoreSheet } from "./more-sheet";
import { toast } from "sonner";

const NAV = [
  { to: "/enquiries", label: "Enquiries", icon: Inbox },
  { to: "/bookings", label: "Bookings", icon: BookMarked },
  { to: "/insights", label: "Insights", icon: LineChart },
  { to: "/business", label: "Business", icon: Brain },
  { to: "/trust", label: "Trust", icon: Shield },
] as const;

const PHONE_NAV = [
  { to: "/enquiries", label: "Today", icon: Inbox },
  { to: "/bookings", label: "Booked", icon: BookMarked },
] as const;

export function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const narrow = useNarrow(860);
  const [jump, setJump] = useState(false);
  const [keys, setKeys] = useState(false);
  const [more, setMore] = useState(false);
  const [goChord, setGoChord] = useState(false);
  const navigate = useNavigate();
  const undoLast = usePrototype((s) => s.undoLast);
  const pauseAny = usePrototype((s) => s.businesses.some((b) => b.paused));
  const setNetworkOffline = usePrototype((s) => s.setNetworkOffline);
  const tickFollowUps = usePrototype((s) => s.tickFollowUps);
  const openCount = usePrototype(
    (s) =>
      s.enquiries.filter(
        (e) =>
          (s.businessFilter === "all" || e.businessId === s.businessFilter) &&
          queueSection(e) === "needs_you",
      ).length,
  );

  useEffect(() => {
    const root = document.documentElement;
    const KEYBOARD = 80;
    const apply = () => {
      const vv = window.visualViewport;
      const inner = window.innerHeight;
      const height = vv?.height ?? inner;
      const top = vv?.offsetTop ?? 0;
      const keyboard = inner - height > KEYBOARD;
      if (keyboard) {
        root.style.setProperty("--app-height", `${Math.round(height)}px`);
        root.style.setProperty("--app-offset-top", `${Math.round(top)}px`);
        root.dataset.keyboard = "1";
      } else {
        root.style.removeProperty("--app-height");
        root.style.removeProperty("--app-offset-top");
        delete root.dataset.keyboard;
      }
    };
    let raf = 0;
    const onChange = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(apply);
    };
    apply();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", onChange);
    vv?.addEventListener("scroll", onChange);
    window.addEventListener("resize", onChange);
    window.addEventListener("orientationchange", onChange);
    return () => {
      cancelAnimationFrame(raf);
      vv?.removeEventListener("resize", onChange);
      vv?.removeEventListener("scroll", onChange);
      window.removeEventListener("resize", onChange);
      window.removeEventListener("orientationchange", onChange);
      root.style.removeProperty("--app-height");
      root.style.removeProperty("--app-offset-top");
      delete root.dataset.keyboard;
    };
  }, []);

  useEffect(() => {
    const apply = () => setNetworkOffline(!navigator.onLine);
    apply();
    window.addEventListener("online", apply);
    window.addEventListener("offline", apply);
    return () => {
      window.removeEventListener("online", apply);
      window.removeEventListener("offline", apply);
    };
  }, [setNetworkOffline]);

  useEffect(() => {
    tickFollowUps();
    const id = window.setInterval(() => tickFollowUps(), 30_000);
    return () => window.clearInterval(id);
  }, [tickFollowUps]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setJump((v) => !v);
        return;
      }
      const t = e.target as HTMLElement | null;
      const typing =
        t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (typing) return;
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        setKeys((v) => !v);
        return;
      }
      if (e.key.toLowerCase() === "u" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        undoLast();
        toast("Undone");
        return;
      }
      if (goChord) {
        setGoChord(false);
        const key = e.key.toLowerCase();
        e.preventDefault();
        if (key === "e") void navigate({ to: "/enquiries" });
        if (key === "b") void navigate({ to: "/bookings" });
        if (key === "i") void navigate({ to: "/insights" });
        if (key === "t") void navigate({ to: "/trust" });
        if (key === "s") void navigate({ to: "/settings" });
        if (key === "n") void navigate({ to: "/business" });
        return;
      }
      if (e.key.toLowerCase() === "g" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setGoChord(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goChord, navigate, undoLast]);

  useEffect(() => {
    const title =
      pathname.startsWith("/enquiries")
        ? "Today · Enquiry"
        : pathname.startsWith("/bookings")
          ? "Booked · Enquiry"
          : pathname.startsWith("/insights")
            ? "Insights · Enquiry"
            : pathname.startsWith("/business")
              ? "Business Brain · Enquiry"
              : pathname.startsWith("/trust")
                ? "Trust · Enquiry"
                : pathname.startsWith("/settings")
                  ? "Settings · Enquiry"
                  : pathname.startsWith("/lab")
                    ? "Lab · Enquiry"
                    : "Enquiry";
    document.title = title;
  }, [pathname]);

  const nav = (inverse: boolean) => (
    <nav aria-label="Primary" className="flex flex-col gap-0.5">
      {NAV.map((item) => {
        const active =
          pathname === item.to || pathname.startsWith(item.to + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium min-h-11 transition-[background-color,color] duration-150 ease-out",
              inverse
                ? active
                  ? "bg-sidebar-fg/10 text-sidebar-fg"
                  : "text-sidebar-muted hover:bg-sidebar-fg/5 hover:text-sidebar-fg"
                : active
                  ? "bg-ink text-paper"
                  : "text-ink-2 hover:bg-paper-2 hover:text-ink",
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {item.label}
            {item.to === "/enquiries" && openCount > 0 ? (
              <span
                className={cn(
                  "ml-auto tabular-nums text-2xs",
                  inverse
                    ? active
                      ? "text-sidebar-fg/60"
                      : "text-sidebar-muted"
                    : active
                      ? "text-paper/70"
                      : "text-stone",
                )}
              >
                {openCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  const moreActive =
    more ||
    pathname.startsWith("/business") ||
    pathname.startsWith("/trust") ||
    pathname.startsWith("/insights") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/lab");
  const enquiryOpen =
    pathname.startsWith("/enquiries/") && pathname !== "/enquiries";

  return (
    <div className="app-root flex h-dvh flex-col overflow-hidden bg-paper text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-paper"
      >
        Skip to content
      </a>
      <SystemBanners />
      <Jump open={jump} onOpenChange={setJump} />
      <KeysHelp open={keys} onOpenChange={setKeys} />
      <MoreSheet open={more} onOpenChange={setMore} />
      {narrow ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <main
            id="main"
            className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", enquiryOpen ? undefined : "phone-safe-top")}
          >
            <Outlet />
          </main>
          {enquiryOpen ? null : (
          <nav
            aria-label="App"
            className="app-nav shrink-0 flex border-t border-line bg-raised"
          >
            {PHONE_NAV.map((item) => {
              const active =
                pathname === item.to || pathname.startsWith(item.to + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "relative flex flex-1 flex-col items-center gap-0.5 py-2 text-2xs font-medium min-h-14 transition-colors duration-150",
                    active ? "text-ink" : "text-stone",
                  )}
                >
                  {active ? (
                    <span className="absolute top-0 h-0.5 w-6 rounded-full bg-ink" aria-hidden />
                  ) : null}
                  <span className="relative">
                    <Icon className="size-5" aria-hidden />
                    {item.to === "/enquiries" && openCount > 0 ? (
                      <span className="absolute -right-2.5 -top-1 min-w-4 rounded-full bg-ink px-1 text-center text-[10px] leading-4 text-paper">
                        {openCount > 9 ? "9+" : openCount}
                      </span>
                    ) : null}
                  </span>
                  {item.label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => setMore(true)}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-0.5 py-2 text-2xs font-medium min-h-14",
                moreActive ? "text-ink" : "text-stone",
              )}
            >
              {moreActive ? (
                <span className="absolute top-0 h-0.5 w-6 rounded-full bg-ink" aria-hidden />
              ) : null}
              <MoreHorizontal className="size-5" aria-hidden />
              More
            </button>
          </nav>
          )}
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[15rem_1fr] overflow-hidden">
          <aside className="flex min-h-0 flex-col bg-sidebar px-3 py-5 text-sidebar-fg">
            <Link to="/enquiries" className="mb-8 px-2">
              <Wordmark inverse />
            </Link>
            <div className="flex-1">
              {nav(true)}
              <div className="mt-3">
                <JumpTrigger inverse onOpen={() => setJump(true)} />
              </div>
            </div>
            {pauseAny ? (
              <p className="mb-3 flex items-center gap-2 px-3 text-xs text-warn-bg">
                <Pause className="size-3" aria-hidden /> Paused
              </p>
            ) : null}
            <div className="border-t border-white/10 pt-3">
              <div className="mb-1 flex justify-end px-1">
                <Notices inverse />
              </div>
              <AccountMenu inverse />
            </div>
          </aside>
          <main id="main" className="min-h-0 min-w-0 overflow-y-auto bg-paper">
            <Outlet />
          </main>
        </div>
      )}
    </div>
  );
}
