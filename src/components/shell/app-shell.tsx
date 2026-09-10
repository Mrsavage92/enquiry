import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  CalendarCheck2,
  CalendarDays,
  BriefcaseBusiness,
  CircleHelp,
  Gift,
  Inbox,
  LineChart,
  MoreHorizontal,
  Pause,
  Settings,
  Sparkle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/ui/wordmark";
import { useNarrow } from "@/lib/use-narrow";
import { usePrototype } from "@/store/prototype-store";
import { queueSection } from "@/domain/labels";
import { AccountMenu } from "./account-menu";
import { SampleWorkspaceBanner } from "./sample-workspace-banner";
import { SystemBanners } from "./system-banners";
import { Jump, JumpTrigger } from "./jump";
import { KeysHelp } from "./keys";
import { Notices } from "./notices";
import { MoreSheet } from "./more-sheet";
import { toast } from "sonner";

const NAV = [
  { to: "/today", label: "Today", icon: CalendarDays },
  { to: "/enquiries", label: "Enquiries", icon: Inbox },
  { to: "/bookings", label: "Booked", icon: CalendarCheck2 },
  { to: "/business", label: "Business", icon: BriefcaseBusiness },
  { to: "/insights", label: "Insights", icon: LineChart },
] as const;

const PHONE_NAV = [
  { to: "/today", label: "Today", icon: CalendarDays },
  { to: "/enquiries", label: "Enquiries", icon: Inbox },
  { to: "/bookings", label: "Booked", icon: CalendarCheck2 },
  { to: "/business", label: "Business", icon: BriefcaseBusiness },
] as const;

export function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const narrow = useNarrow(860) !== false;
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
        if (key === "t") void navigate({ to: "/today" });
        if (key === "e") void navigate({ to: "/enquiries" });
        if (key === "b") void navigate({ to: "/bookings" });
        if (key === "i") void navigate({ to: "/insights" });
        if (key === "s") void navigate({ to: "/settings" });
        if (key === "n") {
          usePrototype.getState().setBrainTab("home");
          void navigate({ to: "/business" });
        }
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
    const title = pathname.startsWith("/today")
      ? "Today · Enquiry"
      : pathname.startsWith("/enquiries")
        ? "Enquiries · Enquiry"
        : pathname.startsWith("/bookings")
          ? "Booked · Enquiry"
          : pathname.startsWith("/insights")
            ? "Insights · Enquiry"
            : pathname.startsWith("/business")
              ? "Business · Enquiry"
              : pathname.startsWith("/trust")
                ? "Trust · Enquiry"
                : pathname.startsWith("/settings")
                  ? "Settings · Enquiry"
                  : pathname.startsWith("/usage")
                    ? "Plan & usage · Enquiry"
                    : pathname.startsWith("/refer")
                      ? "Refer a friend · Enquiry"
                      : pathname.startsWith("/support")
                        ? "Help & support · Enquiry"
                        : pathname.startsWith("/account")
                          ? "Account · Enquiry"
                          : pathname.startsWith("/lab")
                            ? "Lab · Enquiry"
                            : "Enquiry";
    document.title = title;
  }, [pathname]);

  const nav = (inverse: boolean) => (
    <nav aria-label="Primary" className="flex flex-col gap-0.5">
      {NAV.map((item) => {
        const active = pathname === item.to || pathname.startsWith(item.to + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => {
              if (item.to === "/business") usePrototype.getState().setBrainTab("home");
            }}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium min-h-11 transition-[background-color,color,box-shadow] duration-150 ease-out",
              inverse
                ? active
                  ? "bg-[#ede7fa] text-mark-strong"
                  : "text-sidebar-muted hover:bg-white/70 hover:text-sidebar-fg"
                : active
                  ? "bg-mark text-mark-fg"
                  : "text-ink-2 hover:bg-paper-2 hover:text-ink",
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {item.label}
            {item.to === "/today" && openCount > 0 ? (
              <span
                className={cn(
                  "nav-count ml-auto tabular-nums text-2xs",
                  inverse
                    ? active
                      ? "text-sidebar-muted"
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
    pathname.startsWith("/trust") ||
    pathname.startsWith("/insights") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/usage") ||
    pathname.startsWith("/refer") ||
    pathname.startsWith("/support") ||
    pathname.startsWith("/account") ||
    pathname.startsWith("/lab");
  const enquiryOpen = pathname.startsWith("/enquiries/") && pathname !== "/enquiries";

  return (
    <div className="app-root flex h-dvh flex-col overflow-hidden bg-paper text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-paper"
      >
        Skip to content
      </a>
      <SampleWorkspaceBanner />
      <SystemBanners />
      <Jump open={jump} onOpenChange={setJump} />
      <KeysHelp open={keys} onOpenChange={setKeys} />
      <MoreSheet open={more} onOpenChange={setMore} />
      {narrow ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <main
            id="main"
            className={cn(
              "flex min-h-0 flex-1 flex-col overflow-hidden",
              enquiryOpen ? undefined : "phone-safe-top",
            )}
          >
            <Outlet />
          </main>
          {enquiryOpen ? null : (
            <nav
              aria-label="App"
              className="app-nav shrink-0 flex border-t border-line bg-raised/95 backdrop-blur"
            >
              {PHONE_NAV.map((item) => {
                const active = pathname === item.to || pathname.startsWith(item.to + "/");
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => {
                      if (item.to === "/business") usePrototype.getState().setBrainTab("home");
                    }}
                    className={cn(
                      "relative flex flex-1 flex-col items-center gap-0.5 py-2 text-2xs font-medium min-h-14 transition-colors duration-150",
                      active ? "text-mark" : "text-stone",
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    <span
                      className={cn("phone-nav-icon relative", active && "phone-nav-icon-active")}
                    >
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
                  moreActive ? "text-mark" : "text-stone",
                )}
              >
                <span className={cn("phone-nav-icon", moreActive && "phone-nav-icon-active")}>
                  <MoreHorizontal className="size-5" aria-hidden />
                </span>
                More
              </button>
            </nav>
          )}
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[13.5rem_minmax(0,1fr)] overflow-hidden">
          <aside className="app-sidebar flex min-h-0 flex-col border-r border-line bg-sidebar px-3 py-6 text-sidebar-fg">
            <Link to="/today" className="mb-6 px-3">
              <Wordmark inverse />
            </Link>
            <div className="flex-1">
              {nav(true)}
              <div className="mt-3">
                <JumpTrigger inverse onOpen={() => setJump(true)} />
              </div>
            </div>
            {pauseAny ? (
              <p className="mb-3 flex items-center gap-2 px-3 text-xs text-warn">
                <Pause className="size-3" aria-hidden /> Paused
              </p>
            ) : null}
            <div className="space-y-3 border-t border-line pt-3">
              <Link
                to="/usage"
                className="block rounded-lg px-2 py-2 text-sidebar-muted hover:bg-white/70"
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Sparkle className="size-4 text-mark" aria-hidden />
                  Plan & usage
                </div>
              </Link>
              <nav aria-label="Account and support" className="grid gap-1">
                <Link
                  to="/refer"
                  className="flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm text-sidebar-muted hover:bg-white/70 hover:text-sidebar-fg"
                >
                  <Gift className="size-4" aria-hidden />
                  Refer a friend
                </Link>
                <Link
                  to="/support"
                  className="flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm text-sidebar-muted hover:bg-white/70 hover:text-sidebar-fg"
                >
                  <CircleHelp className="size-4" aria-hidden />
                  Help & support
                </Link>
                <Link
                  to="/settings"
                  className="flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm text-sidebar-muted hover:bg-white/70 hover:text-sidebar-fg"
                >
                  <Settings className="size-4" aria-hidden />
                  Settings
                </Link>
              </nav>
              <div className="flex justify-end px-1">
                <Notices inverse />
              </div>
              <AccountMenu inverse />
            </div>
          </aside>
          <main id="main" className="min-h-0 min-w-0 overflow-y-auto bg-raised">
            <Outlet />
          </main>
        </div>
      )}
    </div>
  );
}
