import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { Dialog as DialogRoot, DialogContent } from "@/components/ui/dialog";
import { usePrototype } from "@/store/prototype-store";
import { BUSINESS_BY_ID } from "@/fixtures";
import { derivedLabel } from "@/domain/labels";
import { channelLabel } from "@/domain/channel";
import { dayKeyFromIso, formatTime } from "@/domain/format";
import { cn } from "@/lib/utils";

export function Jump({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const enquiries = usePrototype((s) => s.enquiries);
  const bookings = usePrototype((s) => s.bookings);
  const businesses = usePrototype((s) => s.businesses);
  const setFilter = usePrototype((s) => s.setBusinessFilter);
  const setBrainTab = usePrototype((s) => s.setBrainTab);
  const setBrainFocus = usePrototype((s) => s.setBrainFocusComposer);

  const go = (fn: () => void) => {
    fn();
    onOpenChange(false);
  };

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Jump" className="overflow-hidden sm:max-w-lg">
        <Command label="Jump" className="jump" loop>
          <Command.Input placeholder="Find an enquiry, workspace or page" autoFocus className="field h-11" />
          <Command.List>
            <Command.Empty>Nothing matches.</Command.Empty>
            <Command.Group heading="Enquiries">
              {enquiries.map((e) => {
                  const business = businesses.find((b) => b.id === e.businessId) ?? BUSINESS_BY_ID[e.businessId];
                  return (
                    <Command.Item
                      key={e.id}
                      value={`${e.customerName} ${e.serviceLabel} ${business?.name ?? ""} ${e.fixtureId} ${e.customerHandle ?? ""} ${e.customerPhone ?? ""} ${e.source} ${channelLabel(e.source)}`}
                      keywords={[
                        e.customerName,
                        e.serviceLabel,
                        business?.name ?? "",
                        e.fixtureId,
                        e.customerHandle ?? "",
                        e.customerPhone ?? "",
                        e.source,
                        channelLabel(e.source),
                      ]}
                      onSelect={() =>
                        go(() => {
                          void navigate({ to: "/enquiries/$enquiryId", params: { enquiryId: e.id } });
                        })
                      }
                    >
                      <span className="min-w-0 flex-1 truncate">{e.customerName}</span>
                      <span className="truncate text-xs text-stone">
                        {e.serviceLabel} · {derivedLabel(e.state, e)}
                      </span>
                    </Command.Item>
                  );
                })}
            </Command.Group>
            <Command.Group heading="Bookings">
              {bookings
                .filter((b) => b.status !== "cancelled")
                .map((b) => (
                  <Command.Item
                    key={b.id}
                    value={`${b.customerName} ${b.serviceLabel} booking booked ${b.location ?? ""}`}
                    keywords={[b.customerName, b.serviceLabel, b.location ?? "", "booking", "booked"]}
                    onSelect={() =>
                      go(() => {
                        void navigate({
                          to: "/bookings",
                          search: { on: dayKeyFromIso(b.when), job: b.id },
                        });
                      })
                    }
                  >
                    <span className="min-w-0 flex-1 truncate">{b.customerName}</span>
                    <span className="truncate text-xs text-stone">
                      {formatTime(b.when)} · {b.serviceLabel}
                    </span>
                  </Command.Item>
                ))}
            </Command.Group>
            <Command.Group heading="Pages">
              <Command.Item value="enquiries inbox" onSelect={() => go(() => void navigate({ to: "/enquiries" }))}>
                Enquiries
              </Command.Item>
              <Command.Item value="bookings" onSelect={() => go(() => void navigate({ to: "/bookings" }))}>
                Bookings
              </Command.Item>
              <Command.Item value="insights" onSelect={() => go(() => void navigate({ to: "/insights" }))}>
                Insights
              </Command.Item>
              <Command.Item
                value="business brain knowledge"
                onSelect={() =>
                  go(() => {
                    setBrainTab("all");
                    void navigate({ to: "/business" });
                  })
                }
              >
                Business Brain
              </Command.Item>
              <Command.Item
                value="learning suggestions teach"
                onSelect={() =>
                  go(() => {
                    setBrainTab("learning");
                    void navigate({ to: "/business" });
                  })
                }
              >
                Learning waiting
              </Command.Item>
              <Command.Item
                value="voice"
                onSelect={() =>
                  go(() => {
                    setBrainTab("voice");
                    void navigate({ to: "/business" });
                  })
                }
              >
                Your Voice
              </Command.Item>
              <Command.Item
                value="tell enquiry something changed"
                onSelect={() =>
                  go(() => {
                    setBrainTab("all");
                    setBrainFocus(true);
                    void navigate({ to: "/business" });
                  })
                }
              >
                Tell Enquiry something changed
              </Command.Item>
              <Command.Item value="trust centre" onSelect={() => go(() => void navigate({ to: "/trust" }))}>
                Trust Centre
              </Command.Item>
              <Command.Item value="settings pause mailbox instagram text form how work arrives" onSelect={() => go(() => void navigate({ to: "/settings" }))}>
                Settings
              </Command.Item>
              <Command.Item
                value="trust access mailbox instagram facebook sms"
                onSelect={() => go(() => void navigate({ to: "/trust/access" }))}
              >
                Access
              </Command.Item>
              <Command.Item
                value="follow up waiting at risk"
                onSelect={() =>
                  go(() => {
                    usePrototype.getState().setQueueFilter("at_risk");
                    void navigate({ to: "/enquiries" });
                  })
                }
              >
                Follow-ups
              </Command.Item>
              <Command.Item
                value="customer quote page"
                onSelect={() => go(() => void navigate({ to: "/enquiries" }))}
              >
                Enquiries queue
              </Command.Item>
            </Command.Group>
            <Command.Group heading="Work as">
              <Command.Item
                value="all businesses"
                onSelect={() =>
                  go(() => {
                    setFilter("all");
                    void navigate({ to: "/enquiries" });
                  })
                }
              >
                All businesses
              </Command.Item>
              {businesses.map((b) => (
                <Command.Item
                  key={b.id}
                  value={`${b.name} ${b.industry}`}
                  onSelect={() =>
                    go(() => {
                      setFilter(b.id);
                      void navigate({ to: "/enquiries" });
                    })
                  }
                >
                  {b.name}
                  <span className="text-xs text-stone">{b.industry}</span>
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </DialogRoot>
  );
}

export function JumpTrigger({
  inverse,
  onOpen,
}: {
  inverse?: boolean;
  onOpen: () => void;
}) {
  const [hint, setHint] = useState("Ctrl K");
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) setHint("⌘K");
  }, []);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm transition-[background-color,color] duration-150",
        inverse
          ? "text-sidebar-muted hover:bg-sidebar-fg/5 hover:text-sidebar-fg"
          : "text-ink-2 hover:bg-paper-2 hover:text-ink",
      )}
    >
      <Search className="size-4 shrink-0" aria-hidden />
      <span className="flex-1 text-left">Jump</span>
      <kbd
        className={cn(
          "rounded px-1.5 py-0.5 font-mono text-2xs",
          inverse ? "bg-sidebar-fg/10 text-sidebar-muted" : "bg-paper-2 text-stone",
        )}
      >
        {hint}
      </kbd>
    </button>
  );
}
